import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { FundProject, getFundBalance, getFundProjects, voteFundProject } from "../api";
import type { Session } from "../session";

interface Props {
  session: Session;
}

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function CommunityScreen({ session }: Props) {
  const [balancePaise, setBalancePaise] = useState<number | null>(null);
  const [projects, setProjects] = useState<FundProject[] | null>(null);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const [fund, projectList] = await Promise.all([
      getFundBalance(session.token),
      getFundProjects(session.token),
    ]);
    setBalancePaise(fund.balancePaise);
    setProjects(projectList);
  }, [session.token]);

  useEffect(() => {
    load();
  }, [load]);

  async function castVote(projectId: number, vote: "yes" | "no") {
    try {
      await voteFundProject(session.token, projectId, vote);
      setVotedIds((prev) => new Set(prev).add(projectId));
    } catch {
      // Already voted, or the project closed — the UI already reflects a
      // reasonable state either way once `load()` refreshes.
    }
  }

  if (balancePaise === null || !projects) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const active = projects.filter((p) => p.status === "voting" || p.status === "proposed");
  const history = projects.filter((p) => p.status === "approved" || p.status === "funded" || p.status === "done");

  return (
    <ScrollView style={styles.container}>
      <View style={styles.balanceCard}>
        <Text style={styles.cap}>Village fund</Text>
        <Text style={styles.balance}>{formatRupees(balancePaise)}</Text>
        <Text style={styles.balanceNote}>Accrues automatically from completed collective buys.</Text>
      </View>

      <Text style={styles.sectionTitle}>Active votes</Text>
      {active.length === 0 && <Text style={styles.empty}>No projects up for a vote right now.</Text>}
      {active.map((p) => (
        <View key={p.id} style={styles.projectCard}>
          <Text style={styles.projectTitle}>{p.title}</Text>
          {p.titleKn && <Text style={styles.projectTitleKn}>{p.titleKn}</Text>}
          <Text style={styles.projectEstimate}>Estimated cost: {formatRupees(p.estimatePaise)}</Text>
          {votedIds.has(p.id) ? (
            <Text style={styles.votedNote}>Your vote is recorded.</Text>
          ) : (
            <View style={styles.voteRow}>
              <TouchableOpacity style={[styles.voteBtn, styles.voteYes]} onPress={() => castVote(p.id, "yes")}>
                <Text style={styles.voteBtnText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.voteBtn, styles.voteNo]} onPress={() => castVote(p.id, "no")}>
                <Text style={styles.voteBtnText}>No</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <Text style={styles.sectionTitle}>Funded so far</Text>
      {history.length === 0 && <Text style={styles.empty}>Nothing funded yet — that's next.</Text>}
      {history.map((p) => (
        <View key={p.id} style={styles.historyRow}>
          <Text style={styles.historyTitle}>{p.title}</Text>
          <Text style={styles.historyStatus}>{p.status}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 20, paddingTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  balanceCard: { backgroundColor: "#0E7A5C", borderRadius: 18, padding: 22, marginBottom: 28 },
  cap: { color: "rgba(255,255,255,0.75)", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase" },
  balance: { color: "#fff", fontSize: 30, fontWeight: "700", marginTop: 8 },
  balanceNote: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 10 },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, color: "#666", marginBottom: 12, marginTop: 8 },
  empty: { fontSize: 13, color: "#999", marginBottom: 20 },
  projectCard: { borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 16, marginBottom: 14 },
  projectTitle: { fontSize: 15, fontWeight: "600" },
  projectTitleKn: { fontSize: 13, color: "#888", marginTop: 2 },
  projectEstimate: { fontSize: 12, color: "#666", marginTop: 8 },
  voteRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  voteBtn: { flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: "center" },
  voteYes: { backgroundColor: "#0E7A5C" },
  voteNo: { backgroundColor: "#8c3a34" },
  voteBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  votedNote: { fontSize: 12, color: "#0E7A5C", marginTop: 12, fontWeight: "600" },
  historyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  historyTitle: { fontSize: 14, fontWeight: "500" },
  historyStatus: { fontSize: 12, color: "#0E7A5C", textTransform: "capitalize", fontWeight: "600" },
});
