import { Ionicons } from "@expo/vector-icons";
import {
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Product } from "../api";
import { colors, radii, spacing, type } from "../theme";

function formatPaise(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

interface Props {
  product: Product | null;
  onClose: () => void;
  onOrder: (product: Product) => void;
}

/**
 * Full product detail.
 *
 * The list showed one line per product — a name, a price and nothing else —
 * so everything an organization actually uploaded (the photo at any real size,
 * the description, the pack size, what the saving actually is) was invisible,
 * and a member had to decide from a single line of text.
 *
 * Shows the token reward BEFORE ordering rather than after: it is part of why
 * someone buys here instead of the corner shop, so hiding it until the
 * confirmation wastes it.
 */
export function ProductDetail({ product, onClose, onOrder }: Props) {
  const insets = useSafeAreaInsets();
  if (!product) return null;

  const saving = product.marketPricePaise - product.salePricePaise;
  const savingPct = product.marketPricePaise > 0
    ? Math.round((saving / product.marketPricePaise) * 100)
    : 0;
  const outOfStock = product.quantityAvailable === 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}>
          {product.photoUrl ? (
            <Image source={{ uri: product.photoUrl }} style={styles.hero} resizeMode="cover" />
          ) : (
            <View style={[styles.hero, styles.heroEmpty]}>
              <Ionicons name="cube-outline" size={52} color={colors.faint} />
            </View>
          )}

          <View style={styles.body}>
            {product.categoryName ? (
              <Text style={styles.category}>{product.categoryName.toUpperCase()}</Text>
            ) : null}

            <Text style={styles.name}>{product.nameEn}</Text>
            {product.nameKn ? <Text style={styles.nameKn}>{product.nameKn}</Text> : null}

            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPaise(product.salePricePaise)}</Text>
              {saving > 0 ? (
                <>
                  <Text style={styles.strike}>{formatPaise(product.marketPricePaise)}</Text>
                  <View style={styles.savePill}>
                    <Text style={styles.savePillText}>Save {savingPct}%</Text>
                  </View>
                </>
              ) : null}
            </View>
            {product.unitSpec ? <Text style={styles.unit}>per {product.unitSpec}</Text> : null}

            {/* The reward, stated plainly and before the decision. */}
            {product.tokensOnPurchase > 0 ? (
              <View style={styles.tokenRow}>
                <Text style={styles.tokenGlyph}>◈</Text>
                <Text style={styles.tokenText}>
                  Earn {product.tokensOnPurchase} token{product.tokensOnPurchase === 1 ? "" : "s"}{" "}
                  when you order this
                </Text>
              </View>
            ) : null}

            {product.descriptionEn ? (
              <>
                <Text style={styles.sectionLabel}>About this product</Text>
                <Text style={styles.description}>{product.descriptionEn}</Text>
              </>
            ) : null}

            <Text style={styles.sectionLabel}>Details</Text>
            <View style={styles.specs}>
              <Spec label="Sold by" value={product.organizationName} />
              {product.unitSpec ? <Spec label="Pack size" value={product.unitSpec} /> : null}
              {product.categoryName ? <Spec label="Category" value={product.categoryName} /> : null}
              <Spec
                label="Availability"
                value={outOfStock ? "Out of stock" : `${product.quantityAvailable} left`}
              />
              {saving > 0 ? (
                <Spec label="You save" value={`${formatPaise(saving)} (${savingPct}%)`} />
              ) : null}
            </View>

            <Text style={styles.footnote}>
              Ordering reserves this with the seller. You pay on delivery or collection — there is
              no payment in the app.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <TouchableOpacity
            style={[styles.orderBtn, outOfStock && styles.orderBtnDisabled]}
            disabled={outOfStock}
            onPress={() => onOrder(product)}
            activeOpacity={0.85}
          >
            <Text style={styles.orderBtnText}>{outOfStock ? "Out of stock" : "Order"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.lg,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  // A genuinely large image — the whole point of the detail view. 4:3 rather
  // than a fixed height so it never letterboxes on a tall phone.
  hero: { width: "100%", aspectRatio: 4 / 3, backgroundColor: colors.surface },
  heroEmpty: { alignItems: "center", justifyContent: "center" },
  body: { padding: spacing.lg },
  category: {
    ...type.small,
    color: colors.teal,
    fontWeight: "700",
    letterSpacing: 1.1,
    marginBottom: spacing.xs,
  },
  name: { fontSize: 24, fontWeight: "800", color: colors.ink, lineHeight: 30 },
  nameKn: { fontSize: 17, color: colors.subtle, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginTop: spacing.md },
  price: { fontSize: 26, fontWeight: "800", color: colors.ink },
  strike: { fontSize: 15, color: colors.faint, textDecorationLine: "line-through" },
  savePill: {
    backgroundColor: colors.tealTint,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  savePillText: { fontSize: 12, fontWeight: "700", color: colors.teal },
  unit: { ...type.small, color: colors.subtle, marginTop: 2 },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.brassTint,
  },
  tokenGlyph: { fontSize: 17, color: colors.brass },
  tokenText: { flex: 1, ...type.small, color: colors.ink, fontWeight: "600" },
  sectionLabel: {
    ...type.small,
    color: colors.subtle,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  description: { fontSize: 15, lineHeight: 23, color: colors.ink },
  specs: { borderTopWidth: 1, borderTopColor: colors.border },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specLabel: { ...type.small, color: colors.subtle },
  specValue: { ...type.small, color: colors.ink, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  footnote: { ...type.small, color: colors.faint, lineHeight: 18, marginTop: spacing.lg },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  orderBtnDisabled: { backgroundColor: colors.faint },
  orderBtnText: { color: colors.onDark, fontSize: 16, fontWeight: "700" },
});
