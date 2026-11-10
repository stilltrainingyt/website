---
# A video. Save a copy as src/content/videos/<address>.md. The address is the page's address:
# lowercase words joined by hyphens, never changed after publishing. Its transcript, the
# caption file YouTube Studio gives, goes beside it as src/content/transcripts/<address>.vtt.
# Tracks, modes and topics are the ids in src/data/taxonomy.json.
title:
youtubeId:     # the 11 characters after watch?v= in the YouTube link
slate:         # optional, e.g. ST-002
published:     # e.g. 2026-11-02
track:         # foundations, course or e3
mode:          # e3 only: exploration, expedition or experiment
course:        # course only, e.g. reinforcement-learning
unit:          # course only: 1, 2, 3
topic:         # e.g. ai
duration:      # in quotes, e.g. "13:45"
summary:
pinned: false
hot: false
chapters:      # e.g. - { at: "00:00", title: Why a model needs a direction }
sources:       # e.g. - { text: "Cauchy, 1847. Méthode générale", url: https://example.org }
linked:        # e.g. [writing/<address>]; that article names this video back
---
What the episode covers, in your own words.
