<div align="center">

<img src="media/banner.png" alt="Motion Graphics — promo videos from code, directed, animated, scored and rendered by your agent" width="100%">

[![Agent Skill](https://img.shields.io/badge/Agent_Skill-motion--graphics-111111?style=flat-square)](skills/motion-graphics/SKILL.md)
[![Claude Code plugin](https://img.shields.io/badge/Claude_Code-plugin-D97757?style=flat-square)](#install)
[![npm dependencies](https://img.shields.io/badge/npm_dependencies-0-2EA043?style=flat-square)](#requirements)
[![License: MIT](https://img.shields.io/badge/license-MIT-3B82F6?style=flat-square)](LICENSE)

<img src="media/demo.gif" alt="A 13-second demo reel rendered by the skill" width="720">

<sub>Rendered by the skill, score included · <a href="media/demo.mp4">MP4 with sound</a></sub>

</div>

<br>

Give your agent a link, a repo, screenshots or your own clips, and ask for a video. It directs the film, animates it
in code, composes the music and renders the MP4.

## What it does

- **Directs before it builds** — three concepts, one of nine looks, a plan checked against your words.
- **Reads your brand from a link** — the real interface, logo, colours, fonts and prices.
- **Animates in code** — springs, a moving camera, sub-frame motion blur, 60 fps.
- **Cuts your footage on the beat** — speed ramps, whips, freezes, captions.
- **Scores every video** — an original soundtrack; no two videos sound alike.
- **Critiques itself** — fixes the worst until every score is 8 / 10, then checks every frame.

## How it works

<img src="media/how-it-works.svg" alt="One timeline: frames of the film, scenes with their energy, cues on the beat grid, and the score's waveform with the silence before the logo" width="100%">

One file holds the film: the scenes, how hard each one hits, and every hit as a named cue on the beat grid. The
picture and the score are both built from it — the drop lands on the brand, the silence before the logo is real.

<img src="media/workflow.svg" alt="Eight steps: brief, references, direction, plan check, then scenes, score, critique, render" width="100%">

## The plan is checked first

<img src="media/plan-check.svg" alt="plan-check output: a WARN when the plan is calmer than the words, a PASS after the plan is fixed" width="100%">

Your words set the energy. A plan that breaks them is caught in seconds, before a single frame is rendered.

## Your footage

<img src="media/footage.svg" alt="The scan finds a cut, the camera's direction and the quiet gaps; a speed ramp curve with a 4x rush, slow motion and a freeze" width="100%">

The scan finds the cuts, the camera's direction, the action and the quiet between phrases. The edit lands on the beat.

## Nine looks

<img src="media/looks.svg" alt="Nine looks: product film, terminal release, liquid glass, neon kinetic, editorial print, data story, playful pop, cinematic premium, grid system" width="100%">

## Sound

<img src="media/score-check.png" alt="The score's spectrogram and waveform, with scene starts and cues" width="100%">

A score composed for each video from a built-in synth, checked by eye against its cues, fingerprinted against your
earlier videos.

## Install

```bash
npx skills add Mort1d/motion-graphics-skills
```

As a Claude Code plugin:

```
/plugin marketplace add Mort1d/motion-graphics-skills
/plugin install motion-graphics@motion-graphics-skills
```

Works with Claude Code, Codex, Cursor, Gemini CLI, OpenCode and any agent that supports
[Agent Skills](https://agentskills.io).

## Use

> Here's our site — a dynamic 20-second promo for X. Go all out.

> A 6-second logo sting for my channel, logo attached. Heavy, cinematic.

> Clips from our trip, attached — a vertical reel with wow transitions.

You get `out/<name>.mp4` (60 fps, −14 LUFS), covers, a light copy for messengers and a project that re-renders with
one command. Facts come only from you or your site's public pages; references are studied, never copied.

## Requirements

Node.js 22.4+, ffmpeg, and Chrome, Edge or Chromium. No npm packages, API keys, stock footage or AI video.

## License

[MIT](LICENSE). Bundled fonts: Montserrat and JetBrains Mono, SIL Open Font License 1.1
([OFL.txt](skills/motion-graphics/assets/template/assets/fonts/OFL.txt)).
