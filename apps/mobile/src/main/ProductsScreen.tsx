import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getDeliveryAddress,
  getMyOrders,
  getProducts,
  MyOrder,
  orderProduct,
  Product,
} from "../api";
import { Bilingual } from "../components/Bilingual";
import { Card } from "../components/Card";
import { strings } from "../i18n/strings";
import type { Session } from "../session";
import { colors, radii, spacing, type } from "../theme";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function ProductsScreen({ session }: { session: Session }) {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [myOrders, setMyOrders] = useState<MyOrder[] | null>(null);
  const [ordering, setOrdering] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  // Only whether one EXISTS — the address text itself never needs to come to
  // this screen, so it doesn't.
  const [hasAddress, setHasAddress] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  // Minted once per order attempt when the sheet opens, NOT per submit — a
  // retry after a timeout has to carry the same key or the server can't tell
  // it apart from a second order. Reopening the sheet starts a new attempt.
  const [orderKey, setOrderKey] = useState<string | null>(null);


  const load = useCallback(async () => {
    const [productList, orderList, addr] = await Promise.all([
      getProducts(session.token),
      getMyOrders(session.token),
      getDeliveryAddress(session.token).catch(() => ({ address: null })),
    ]);
    setProducts(productList);
    setMyOrders(orderList);
    setHasAddress(addr.address !== null);
  }, [session.token]);

  useEffect(() => {
    load().catch(() => {
      setProducts([]);
      setMyOrders([]);
    });
  }, [load]);

  function openOrder(product: Product) {
    setOrdering(product);
    setQuantity(1);
    setOrderError(null);
    setOrderKey(Crypto.randomUUID());
  }

  // The address is NOT asked for here. It lives in the Vault, it is managed in
  // the Vault, and an order should never be gated behind retyping it. If none
  // is on file the order still succeeds and the banner below prompts for one.
  async function confirmOrder() {
    if (!ordering || !orderKey) return;
    setSubmitting(true);
    setOrderError(null);
    try {
      const res = await orderProduct(session.token, ordering.id, quantity, orderKey);
      setOrdering(null);
      if (res.needsDeliveryAddress) {
        setHasAddress(false);
        Alert.alert(
          strings.products.orderPlaced.en,
          "Add a delivery address in your Vault, or collect from your local PACS centre, so this can reach you."
        );
      } else {
        Alert.alert(strings.products.orderPlaced.en, strings.products.orderPlaced.kn);
      }
      await load();
    } catch (err) {
      setOrderError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!products || !myOrders) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: spacing.lg }]}>
      {/* Pinned above the scroll, not inside it: an undeliverable order is not
          something to discover by scrolling past it. Shown only once it is
          actionable — an order exists and there is nowhere to send it — so
          someone who has never ordered is never nagged. */}
      {hasAddress === false && myOrders.length > 0 && (
        <View style={styles.addressWarning}>
          <Ionicons name="alert-circle" size={20} color={colors.onDark} />
          <Text style={styles.addressWarningText}>
            {myOrders.length === 1 ? "Your order can't be delivered yet." : "Your orders can't be delivered yet."}{" "}
            Add your address in the Vault, or collect from your local PACS centre.
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <Bilingual {...strings.products.heading} size={22} weight="700" style={styles.heading as any} />

        {products.length === 0 ? (
          <Card variant="outline" style={styles.emptyCard}>
            <Ionicons name="storefront-outline" size={32} color={colors.teal} />
            <Bilingual
              {...strings.products.empty}
              size={14}
              weight="500"
              tone="subtle"
              style={styles.emptyText as any}
            />
          </Card>
        ) : (
          products.map((p) => (
            <Card key={p.id} style={styles.productCard}>
              <View style={styles.productRow}>
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.photo} />
                ) : (
                  <View style={[styles.photo, styles.photoPlaceholder]}>
                    <Ionicons name="cube-outline" size={22} color={colors.faint} />
                  </View>
                )}
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{p.nameEn}</Text>
                  {p.nameKn && <Text style={styles.productNameKn}>{p.nameKn}</Text>}
                  <Text style={styles.productMeta}>
                    {p.unitSpec ? `${p.unitSpec} · ` : ""}
                    {p.organizationName}
                  </Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.salePrice}>{formatPaise(p.salePricePaise)}</Text>
                    {p.marketPricePaise > p.salePricePaise && (
                      <Text style={styles.marketPrice}>{formatPaise(p.marketPricePaise)}</Text>
                    )}
                  </View>
                  <Text style={styles.qtyLabel}>{p.quantityAvailable} left</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.orderBtn, p.quantityAvailable === 0 && styles.orderBtnDisabled]}
                disabled={p.quantityAvailable === 0}
                onPress={() => openOrder(p)}
                activeOpacity={0.85}
              >
                <Text style={styles.orderBtnText}>
                  {p.quantityAvailable === 0 ? strings.products.outOfStock.en : strings.products.order.en}
                </Text>
              </TouchableOpacity>
            </Card>
          ))
        )}

        <Bilingual
          {...strings.products.myOrders}
          size={16}
          weight="700"
          style={styles.ordersHeading as any}
        />
        {myOrders.length === 0 ? (
          <Text style={styles.emptyOrdersText}>{strings.products.noOrders.en}</Text>
        ) : (
          myOrders.map((o) => (
            <View key={o.id} style={styles.orderRow}>
              <Text style={styles.orderName}>{o.name_en}</Text>
              <Text style={styles.orderMeta}>
                {o.quantity} × {formatPaise(o.unit_price_paise)} · {o.status}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!ordering} animationType="slide" transparent onRequestClose={() => setOrdering(null)}>
        {/* The sheet is pinned to the bottom, so an open keyboard sits right on
            top of the address field and the confirm button. AndroidManifest
            already sets adjustResize, but that resizes the ACTIVITY window and
            doesn't reach inside a Modal — the sheet needs to move itself.
            'height' on Android and 'padding' on iOS is the combination that
            actually shifts a flex-end sheet on both. */}
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            {/* Scrollable so the confirm button stays reachable on a short
                screen once the keyboard has taken half of it. */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
            <Text style={styles.modalTitle}>{ordering?.nameEn}</Text>

            <Text style={styles.modalLabel}>{strings.products.quantity.en}</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Text style={styles.stepperBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() =>
                  setQuantity((q) => Math.min(ordering?.quantityAvailable ?? q, q + 1))
                }
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            {orderError && <Text style={styles.orderErrorText}>{orderError}</Text>}

            <TouchableOpacity
              style={[styles.confirmBtn, submitting && styles.orderBtnDisabled]}
              disabled={submitting}
              onPress={confirmOrder}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onDark} />
              ) : (
                <Text style={styles.orderBtnText}>{strings.products.confirmOrder.en}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setOrdering(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.paper },
  heading: { marginBottom: spacing.lg, color: colors.ink },
  addressWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  addressWarningText: { flex: 1, ...type.small, color: colors.onDark, lineHeight: 19, fontWeight: "600" },
  emptyCard: { alignItems: "flex-start", gap: spacing.sm, marginBottom: spacing.lg },
  emptyText: { color: colors.ink, lineHeight: 21 },
  productCard: { marginBottom: spacing.md },
  productRow: { flexDirection: "row", gap: spacing.md },
  photo: { width: 64, height: 64, borderRadius: radii.md },
  photoPlaceholder: { backgroundColor: colors.paper, alignItems: "center", justifyContent: "center" },
  productInfo: { flex: 1 },
  productName: { ...type.subtitle, fontSize: 15, color: colors.ink },
  productNameKn: { fontSize: 13, color: colors.subtle, marginTop: 1 },
  productMeta: { fontSize: 12, color: colors.mist, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs, marginTop: spacing.xs },
  salePrice: { fontSize: 16, fontWeight: "700", color: colors.teal },
  marketPrice: { fontSize: 12, color: colors.faint, textDecorationLine: "line-through" },
  qtyLabel: { fontSize: 11, color: colors.mist, marginTop: 2 },
  orderBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  orderBtnDisabled: { backgroundColor: colors.tealSoft },
  orderBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },
  ordersHeading: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.ink },
  emptyOrdersText: { fontSize: 13, color: colors.faint },
  orderRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  orderName: { fontSize: 14, fontWeight: "600", color: colors.ink },
  orderMeta: { fontSize: 12, color: colors.mist, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    // Caps the sheet so a keyboard-squeezed layout scrolls inside the card
    // instead of pushing the title off the top of the screen.
    maxHeight: "88%",
  },
  modalTitle: { ...type.title, color: colors.ink, marginBottom: spacing.md },
  modalLabel: { ...type.small, color: colors.subtle, fontWeight: "600", marginBottom: spacing.xs, marginTop: spacing.md },
  stepper: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: { fontSize: 18, fontWeight: "700", color: colors.ink },
  stepperValue: { fontSize: 16, fontWeight: "700", color: colors.ink, minWidth: 24, textAlign: "center" },
  addressInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.base,
    fontSize: 15,
    color: colors.ink,
    minHeight: 60,
    textAlignVertical: "top",
  },
  orderErrorText: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  confirmBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtn: { marginTop: spacing.sm, alignItems: "center", paddingVertical: spacing.sm },
  cancelBtnText: { color: colors.subtle, fontSize: 14, fontWeight: "600" },
});
