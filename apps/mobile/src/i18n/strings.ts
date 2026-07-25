// Draft Kannada translations for static UI chrome (tab labels, button text,
// empty states) — everything that ISN'T already server-supplied bilingual
// content (question/option/project text already carries its own textKn).
// These are a starting point, not a finished translation: SPEC.md §19G
// already tracks a full Kannada copy review as open, unfinished work — this
// file is exactly the kind of copy that review needs to check.
export const strings = {
  tabs: {
    home: { en: "Home", kn: "ಮುಖಪುಟ" },
    pulse: { en: "Pulse", kn: "ಪಲ್ಸ್" },
    community: { en: "Community", kn: "ಸಮುದಾಯ" },
    vault: { en: "Vault", kn: "ವಾಲ್ಟ್" },
  },
  home: {
    yourTokens: { en: "Your tokens", kn: "ನಿಮ್ಮ ಟೋಕನ್‌ಗಳು" },
    issued: { en: "Issued", kn: "ನೀಡಲಾದ" },
    realised: { en: "Realised", kn: "ವಾಸ್ತವಿಕಗೊಂಡ" },
    todaysPulse: { en: "Today's Pulse", kn: "ಇಂದಿನ ಪಲ್ಸ್" },
    recentActivity: { en: "Recent activity", kn: "ಇತ್ತೀಚಿನ ಚಟುವಟಿಕೆ" },
    emptyActivity: {
      en: "Nothing yet — answer today's Pulse.",
      kn: "ಇನ್ನೂ ಏನೂ ಇಲ್ಲ — ಇಂದಿನ ಪಲ್ಸ್‌ಗೆ ಉತ್ತರಿಸಿ.",
    },
    pendingOne: { en: "question waiting", kn: "ಪ್ರಶ್ನೆ ಕಾಯುತ್ತಿದೆ" },
    pendingMany: { en: "questions waiting", kn: "ಪ್ರಶ್ನೆಗಳು ಕಾಯುತ್ತಿವೆ" },
    allDone: { en: "All caught up for today", kn: "ಇಂದಿಗೆ ಎಲ್ಲಾ ಪೂರ್ಣಗೊಂಡಿದೆ" },
  },
  pulse: {
    questionOf: { en: "Question", kn: "ಪ್ರಶ್ನೆ" },
    of: { en: "of", kn: "ರಲ್ಲಿ" },
    allCaughtUp: { en: "All caught up", kn: "ಎಲ್ಲಾ ಪೂರ್ಣಗೊಂಡಿದೆ" },
    moreTomorrow: { en: "More questions tomorrow.", kn: "ನಾಳೆ ಇನ್ನಷ್ಟು ಪ್ರಶ್ನೆಗಳು." },
    checkAgain: { en: "Check again", kn: "ಮತ್ತೆ ಪರಿಶೀಲಿಸಿ" },
    confirm: { en: "Confirm", kn: "ದೃಢೀಕರಿಸಿ" },
    numericPlaceholder: { en: "Type a number", kn: "ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ" },
    addNote: { en: "Add a note (optional)", kn: "ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ (ಐಚ್ಛಿಕ)" },
    freeTextPlaceholder: { en: "Type your answer", kn: "ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಟೈಪ್ ಮಾಡಿ" },
    recordVoiceNote: { en: "Record a voice note", kn: "ಧ್ವನಿ ಟಿಪ್ಪಣಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ" },
    recording: { en: "Recording… tap to stop", kn: "ರೆಕಾರ್ಡ್ ಆಗುತ್ತಿದೆ… ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ" },
    transcribing: { en: "Transcribing…", kn: "ಬರೆಯುತ್ತಿದೆ…" },
    transcribeFailedTitle: { en: "Couldn't transcribe", kn: "ಬರೆಯಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ" },
    attachPhoto: { en: "Attach a photo", kn: "ಫೋಟೋ ಲಗತ್ತಿಸಿ" },
    photoAttached: { en: "Photo attached", kn: "ಫೋಟೋ ಲಗತ್ತಿಸಲಾಗಿದೆ" },
    removePhoto: { en: "Remove", kn: "ತೆಗೆದುಹಾಕಿ" },
    photoRejectedTitle: { en: "Photo rejected", kn: "ಫೋಟೋ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ" },
    photoRejectedBody: {
      en: "This looks like it contains a person. Try again without one.",
      kn: "ಇದರಲ್ಲಿ ವ್ಯಕ್ತಿ ಇರುವಂತೆ ಕಾಣುತ್ತದೆ. ವ್ಯಕ್ತಿ ಇಲ್ಲದೆ ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
    },
  },
} as const;
