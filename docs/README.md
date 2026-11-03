# Documentation

Mahjong Scorer is a local-first Hong Kong mahjong scorer. These docs explain how it is built and why. Start with the architecture overview, then read the decision records for the reasoning behind each choice.

| Document                                              | What it answers                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| [Architecture](architecture.md)                       | What are the pieces, how does data flow, and where are the boundaries? |
| [Decision records](adr/README.md)                     | Why was each major choice made, and what did it cost?                  |
| [Scoring rules](scoring-rules.md)                     | How does the engine score a hand, and how is that kept correct?        |
| [Security and privacy](security-and-privacy.md)       | What protects the API key, the budget and player data?                 |
| [Testing](testing.md)                                 | What is tested, how, and what gates a merge?                           |
| [Development workflow](development-workflow.md)       | How do branches, reviews and parallel agent work fit together?         |
| [Limitations and roadmap](limitations-and-roadmap.md) | What is unfinished, what is known to be weak, and what comes next?     |

For setup and commands, see the [project README](../README.md).
