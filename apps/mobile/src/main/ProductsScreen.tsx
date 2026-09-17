import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getMyOrders,
  getProducts,
  MyOrder,
  orderProduct,
  Product,
  setDeliveryAddress,
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
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [productList, orderList] = await Promise.all([
      getProducts(session.token),
      getMyOrders(session.token),
    ]);
    setProducts(productList);
    setMyOrders(orderList);
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
    setAddress("");
    setOrderError(null);
  }

  async function confirmOrder() {
    if (!ordering) return;
    if (!address.trim()) {
      setOrderError("Enter a delivery address.");
      return;
    }
    setSubmitting(true);
    setOrderError(null);
    try {
      await setDeliveryAddress(session.token, address.trim());
      await orderProduct(session.token, ordering.id, quantity);
      setOrdering(null);
      Alert.alert(strings.products.orderPlaced.en, strings.products.orderPlaced.kn);
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
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
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
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
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

            <Text style={styles.modalLabel}>{strings.products.deliveryAddress.en}</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder={strings.products.deliveryAddressPlaceholder.en}
              placeholderTextColor={colors.faint}
              multiline
            />

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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: spacing.lg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.paper },
  heading: { marginBottom: spacing.lg, color: colors.ink },
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
