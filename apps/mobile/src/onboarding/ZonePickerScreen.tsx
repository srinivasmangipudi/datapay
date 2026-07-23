import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getZones, type Zone } from "../api";

interface Props {
  onSelected: (zone: Zone) => void;
}

const LEVEL_ORDER: Zone["level"][] = ["constituency", "hobli", "panchayat", "village"];

export function ZonePickerScreen({ onSelected }: Props) {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [path, setPath] = useState<Zone[]>([]); // breadcrumb of selections, root to leaf

  useEffect(() => {
    getZones()
      .then(setZones)
      .catch((err) => Alert.alert("Couldn't load zones", (err as Error).message));
  }, []);

  if (!zones) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const currentParentId = path.length > 0 ? path[path.length - 1].id : null;
  const currentLevel = LEVEL_ORDER[path.length];
  const options = zones.filter(
    (z) => z.parentId === currentParentId && z.level === currentLevel
  );

  function selectZone(zone: Zone) {
    if (zone.level === "village") {
      onSelected(zone);
      return;
    }
    setPath([...path, zone]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Where are you?</Text>
      <Text style={styles.subtitle}>
        {path.length === 0 ? "Pick your constituency" : path.map((z) => z.name).join(" → ")}
      </Text>

      <FlatList
        data={options}
        keyExtractor={(z) => z.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => selectZone(item)}>
            <Text style={styles.rowText}>{item.name}</Text>
            <Text style={styles.rowSub}>{item.nameKn}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.subtitle}>No zones at this level yet.</Text>}
      />

      {path.length > 0 && (
        <TouchableOpacity style={styles.backButton} onPress={() => setPath(path.slice(0, -1))}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 24 },
  row: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowText: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 13, color: "#888", marginTop: 2 },
  backButton: { paddingVertical: 16 },
  backText: { color: "#0E7A5C", fontWeight: "600" },
});
