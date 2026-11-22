# Build Log

Running record of what the agent did vs. what I verified or changed. Used for the writeup.

| Date       | Agent did                            | I verified                                                       | I changed                                                                                                                   |
| ---------- | ------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Sat Nov 21 | Scaffolded the DeepSpace app         | First deploy loads on my phone at quizzo.app.space               | —                                                                                                                           |
| Sun Nov 22 | Drafted the screen spec from my idea | Reviewed it against my wireframe                                 | Dropped the quiz review step (it would spoil the answers); moved mode choice to Pick chapter; added Join room on Home       |
| Sun Nov 22 | —                                    | Checked the free tier limits (500 credits, 1 deployment, 1 GiB)  | Cut quiz history/best scores; AI billed to the app owner via DeepSpace proxy; 20 MB upload limit; one app-wide record scope |
| Sun Nov 22 | —                                    | `deepspace status` shows the app deploys from the DeepSpace repo | Added the spec instruction to AGENTS.md so the agent reads docs/SPEC.md first                                               |
