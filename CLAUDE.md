# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MLB Bandwagon is a simple client-side web application that implements the "bandwagon fan" concept for Major League Baseball. Users select a starting team and the app traces a path by following the team that beats them in each subsequent loss, ultimately arriving at their "bandwagon team."

## Architecture

This is a vanilla JavaScript single-page application with no build process or dependencies:

- **index.html**: Main HTML structure with team selector, loading state, and results display
- **script.js**: Contains the `MLBBandwagon` class that handles:
  - Loading MLB teams from the official MLB Stats API (`https://statsapi.mlb.com/api/v1/teams`)
  - Tracing the bandwagon path by finding each team's next loss via game schedules
  - Rendering the journey and final bandwagon team
- **styles.css**: All styling using modern CSS with flexbox, gradients, and responsive design

## Key Implementation Details

The core algorithm in `traceBandwagon()` method:
1. Starts from user-selected team and current season start date
2. For each team, finds their next loss using `findNextLoss()`
3. Switches to the team that beat them
4. Continues until no more losses found or season end reached

The app filters for active MLB teams in AL (league ID 103) and NL (league ID 104) and only processes regular season games (gameType 'R').

## Running the Application

This is a static web application - simply open `index.html` in a web browser or serve it from any HTTP server. No build commands or dependencies required.