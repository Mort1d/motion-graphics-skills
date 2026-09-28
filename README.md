<div align="center">

# Motion Graphics Skills

**Showreel-grade motion graphics from code — with an original soundtrack for every video.**

**English** · [Русский](README.ru.md)

[![Agent Skill](https://img.shields.io/badge/Agent_Skill-motion--graphics-111111?style=flat-square)](skills/motion-graphics/SKILL.md)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#install)
[![npm dependencies](https://img.shields.io/badge/npm_dependencies-0-2EA043?style=flat-square)](#requirements)
[![License: MIT](https://img.shields.io/badge/license-MIT-3B82F6?style=flat-square)](LICENSE)

<img src="media/demo.gif" alt="A 13-second demo reel rendered by the skill" width="640">

<sub>The template's demo for a fictional brand, rendered by the skill's own tools · <a href="media/demo.mp4">full-quality MP4</a></sub>

</div>

## What it does

Give your agent a link to a site, a few reference posts from X or Telegram, or just screenshots — and ask for a video.

- **Reads the brand from the link** — real UI blocks at 2×, the logo, the colours the site actually paints, its
  fonts, prices and contacts.
- **Studies the references by numbers** — how much of the frame moves, visual hits per minute, how many land on the
  beat.
- **Writes the direction first** — every shot on a beat grid, how it enters and leaves, palette, type, a banned list.
- **Renders real motion graphics** — HTML scenes captured frame by frame in headless Chrome, with sub-frame motion
  blur.
- **Composes an original score** — a built-in synth with 80 voices and 22 genre cards, sound design on every cut,
  and a fingerprint check so no two videos sound alike.
- **Checks everything** — loudness and true peak of every file, fps, gaps between scenes, missing glyphs, leftover
  template code.

Promos · launch videos · explainers · intros · logo stings · Reels, Shorts and TikTok.

## Install

```bash
npx skills add Mort1d/motion-graphics-skills
```

As a Claude Code plugin:

```
/plugin marketplace add Mort1d/motion-graphics-skills
/plugin install motion-graphics@motion-graphics-skills
```

Or copy `skills/motion-graphics` into your agent's skills folder (`~/.claude/skills/` for Claude Code). It works with
Claude Code, Codex, Cursor, Gemini CLI, OpenCode and any agent that supports [Agent Skills](https://agentskills.io).

## Use

Plain words in any language are enough:

> References: https://x.com/…/status/… https://x.com/…/status/… https://x.com/…/status/… — make a dynamic motion
> graphics promo for our coffee shop, zerno.example. Go all out. Orders go through @zerno_example_bot.

> A 6-second logo sting for my YouTube channel, logo attached. Heavy, cinematic.

> Vertical 9:16, 20 seconds, for a kids' drawing school. Bright and fun, stylish music.

You get `out/<name>.mp4` (1080p or vertical, 60 fps, −14 LUFS), a light copy for messengers, covers, and a project
that re-renders with one command. On request: other languages, a 9:16 version, a 15-second cut.

## Requirements

| | |
|---|---|
| Node.js | 22.4 or newer |
| ffmpeg + ffprobe | on PATH |
| Browser | Chrome, Edge, Chromium or Brave; set `CHROME_PATH` to choose one |
| OS | Windows, macOS, Linux |

No npm packages, API keys, stock footage or AI video models. The network is used only to read the links you give.
In a chat app without a shell, the agent writes the whole project and hands it over with the commands that render it.

<details>
<summary><b>Why every video sounds different</b></summary>
<br>

Left alone, every model answers "more energy" with the same house groove in A minor. Here each video gets a sound
brief (genre, tempo, key, a sonic logo, 2–4 sounds from the brand's world), and a starting point rotated by the
brand's name and away from your earlier videos:

```bash
node tools/sound-print.mjs --suggest "Loafly" --world food --in ~/videos
```

Every finished score is fingerprinted — where the kick, snare and hats fall in the bar, timbre, tempo, key — and
compared with the demo and with the other videos in the folder. The check names what matches ("groove 0.87, timbre
0.84") so the agent knows what to change. Calibrated on six real promos from one synth kit: the five house-like ones
score 0.74–0.96 with each other and get flagged.

<img src="media/score-check.png" alt="The score check: spectrogram and waveform with scene starts and cues" width="760">

What the agent looks at instead of listening: every hit on its cue line, the silence before the logo as a dark
column.

</details>

<details>
<summary><b>How it was tested</b></summary>
<br>

Three briefs end to end — a coffee shop in Russian (16:9), a kids' drawing school (9:16), an English SaaS launch —
with Claude Sonnet, graded by script, the skill fixed after each round:

| Round | Graded checks passed | Sound vs. six earlier promos (1 = same) |
|---|---|---|
| 1 | 41 / 42 | up to 0.86: house-like, every brief in A minor |
| 2 | 38 / 42 | up to 0.85: two briefs on the same 116 BPM disco groove |
| 3 | 42 / 42 | 0.34 – 0.66, under 0.75 with each other |

Round 4 was the author's own prompt, word for word — four X links, a real business that sells through a Telegram
bot, "go all out" — with Claude Opus: a 32.8-second promo and a 15-second cut, liquid drum & bass at 174 BPM, 0.50 at
most against the six earlier promos, QA passed. What it found (encoder peaks on derived files, a half-speed tempo
reading, a font without ₽) was fixed and re-tested.

</details>

<details>
<summary><b>Repository layout</b></summary>
<br>

```
skills/motion-graphics/
  SKILL.md           the workflow the agent follows
  references/        story & motion craft, scene cookbook, sound design, genre cards, synth API, pipeline
  scripts/           site-kit, ref-sheet, new-project, trace-logo, palette
  assets/template/   a working project: scenes, motion kit, synth, capture / render / QA tools
.claude-plugin/      marketplace.json for Claude Code
media/               the demo
evals/               test prompts
```

</details>

## Responsible use

The skill tells the agent to use only facts from the brief, the site or the user; to read only public pages (no
logins, bot checks respected); to keep personal data out of the video; to learn from references without copying
their footage, words or music; and to follow advertising rules for the client's market.

## License

[MIT](LICENSE). Bundled fonts: Montserrat and JetBrains Mono, SIL Open Font License 1.1
([OFL.txt](skills/motion-graphics/assets/template/assets/fonts/OFL.txt)).
