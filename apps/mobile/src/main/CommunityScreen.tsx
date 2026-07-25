import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FundProject, getFundBalance, getFundProjects, proposeFundProject, voteFundProject } from "../api";
import { colors, radii, spacing, type } from "../theme";
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
  const [votingIds, setVotingIds] = useState<Set<number>>(new Set());

  const [showProposeForm, setShowProposeForm] = useState(false);
  const [proposeTitle, setProposeTitle] = useState("");
  const [proposeEstimate, setProposeEstimate] = useState("");
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

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
    setVotingIds((prev) => new Set(prev).add(projectId));
    try {
      await voteFundProject(session.token, projectId, vote);
      await load();
    } catch {
      // Already voted, or the project closed — reloading below reflects the
      // real server state either way, so there's nothing else to do here.
    } finally {
      setVotingIds((prev) => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  }

  async function submitProposal() {
    const title = proposeTitle.trim();
    const rupees = Number(proposeEstimate);
    if (!title) {
      setProposeError("Give the project a name.");
      return;
    }
    if (!Number.isFinite(rupees) || rupees <= 0) {
      setProposeError("Enter a valid estimated cost in rupees.");
      return;
    }
    setProposeError(null);
    setProposing(true);
    try {
      await proposeFundProject(session.token, title, Math.round(rupees * 100));
      setProposeTitle("");
      setProposeEstimate("");
      setShowProposeForm(false);
      await load();
    } catch (err) {
      setProposeError(err instanceof Error ? err.message : "Couldn't submit — try again.");
    } finally {
      setProposing(false);
    }
  }

  if (balancePaise === null || !projects) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.teal} />
      </View>
    );
  }

  const active = projects.filter((p) => p.status === "voting" || p.status === "proposed");
  const history = projects.filter((p) => p.status === "approved" || p.status === "funded" || p.status === "done");

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.balanceCard}>
          <Text style={styles.cap}>Village fund</Text>
          <Text style={styles.balance}>{formatRupees(balancePaise)}</Text>
          <Text style={styles.balanceNote}>Accrues automatically from completed collective buys.</Text>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active votes</Text>
          <TouchableOpacity onPress={() => setShowProposeForm((v) => !v)}>
            <Text style={styles.proposeToggle}>{showProposeForm ? "Cancel" : "+ Propose a project"}</Text>
          </TouchableOpacity>
        </View>

        {showProposeForm && (
          <View style={styles.proposeCard}>
            <Text style={styles.proposeLabel}>Project name</Text>
            <TextInput
              value={proposeTitle}
              onChangeText={setProposeTitle}
              placeholder="e.g. Streetlight repair"
              placeholderTextColor={colors.faint}
              style={styles.input}
            />
            <Text style={styles.proposeLabel}>Estimated cost (₹)</Text>
            <TextInput
              value={proposeEstimate}
              onChangeText={setProposeEstimate}
              placeholder="e.g. 5000"
              placeholderTextColor={colors.faint}
              keyboardType="numeric"
              style={styles.input}
            />
            {proposeError && <Text style={styles.proposeError}>{proposeError}</Text>}
            <TouchableOpacity
              style={[styles.submitBtn, proposing && styles.submitBtnDisabled]}
              onPress={submitProposal}
              disabled={proposing}
            >
              {proposing ? (
                <ActivityIndicator color={colors.onDark} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>Submit to your village</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {active.length === 0 && !showProposeForm && (
          <Text style={styles.empty}>No projects up for a vote right now — propose one above.</Text>
        )}
        {active.map((p) => (
          <View key={p.id} style={styles.projectCard}>
            <Text style={styles.projectTitle}>{p.title}</Text>
            {p.titleKn && <Text style={styles.projectTitleKn}>{p.titleKn}</Text>}
            <Text style={styles.projectEstimate}>Estimated cost: {formatRupees(p.estimatePaise)}</Text>
            <View style={styles.voteRow}>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  styles.voteYes,
                  p.myVote === "yes" && styles.voteChosen,
                  p.myVote !== null && p.myVote !== "yes" && styles.voteDimmed,
                ]}
                onPress={() => castVote(p.id, "yes")}
                disabled={p.myVote !== null || votingIds.has(p.id)}
              >
                <Text style={styles.voteBtnText}>▲ {p.yesVotes}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.voteBtn,
                  styles.voteNo,
                  p.myVote === "no" && styles.voteChosen,
                  p.myVote !== null && p.myVote !== "no" && styles.voteDimmed,
                ]}
                onPress={() => castVote(p.id, "no")}
                disabled={p.myVote !== null || votingIds.has(p.id)}
              >
                <Text style={styles.voteBtnText}>▼ {p.noVotes}</Text>
              </TouchableOpacity>
            </View>
            {p.myVote !== null && (
              <Text style={styles.votedNote}>
                You {p.myVote === "yes" ? "upvoted" : "downvoted"} this project.
              </Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.paper, padding: spacing.xl, paddingTop: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.paper },
  balanceCard: { backgroundColor: colors.teal, borderRadius: radii.lg, padding: 22, marginBottom: spacing.xxl },
  cap: { ...type.label, color: colors.onDarkSubtle },
  balance: { ...type.display, color: colors.onDark, marginTop: spacing.sm },
  balanceNote: { ...type.small, color: colors.onDarkSubtle, marginTop: spacing.md },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  sectionTitle: { ...type.label, color: colors.subtle, marginBottom: spacing.md },
  proposeToggle: { ...type.small, color: colors.teal, fontWeight: "700", marginBottom: spacing.md },
  proposeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.base,
    marginBottom: spacing.lg,
  },
  proposeLabel: { ...type.caption, color: colors.subtle, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  proposeError: { ...type.small, color: colors.danger, marginTop: spacing.sm },
  submitBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: spacing.base,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 14 },
  empty: { ...type.small, color: colors.faint, marginBottom: spacing.xl },
  projectCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.base,
    marginBottom: spacing.md,
  },
  projectTitle: { ...type.subtitle, fontSize: 15, color: colors.ink },
  projectTitleKn: { ...type.small, color: colors.mist, marginTop: 2 },
  projectEstimate: { ...type.caption, color: colors.subtle, marginTop: spacing.sm },
  voteRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  voteBtn: { flex: 1, borderRadius: radii.pill, paddingVertical: 10, alignItems: "center" },
  voteYes: { backgroundColor: colors.teal },
  voteNo: { backgroundColor: colors.danger },
  voteChosen: { borderWidth: 2, borderColor: colors.ink },
  voteDimmed: { opacity: 0.4 },
  voteBtnText: { color: colors.onDark, fontWeight: "700", fontSize: 13 },
  votedNote: { ...type.caption, color: colors.teal, marginTop: spacing.md, fontWeight: "700" },
  historyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyTitle: { ...type.body, fontWeight: "500", color: colors.ink },
  historyStatus: { ...type.caption, color: colors.teal, textTransform: "capitalize", fontWeight: "700" },
});
