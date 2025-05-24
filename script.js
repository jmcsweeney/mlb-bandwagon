class MLBBandwagon {
    constructor() {
        this.teamSelect = document.getElementById('team-select');
        this.findButton = document.getElementById('find-bandwagon');
        this.loading = document.getElementById('loading');
        this.results = document.getElementById('results');
        this.teamChain = document.getElementById('team-chain');
        this.finalTeam = document.getElementById('final-team');
        
        
        this.teamColors = {
            108: '#C4CED4', // Angels
            109: '#003263', // Diamondbacks
            110: '#13274F', // Orioles
            111: '#BD3039', // Red Sox
            112: '#0E3386', // Cubs
            113: '#C6011F', // Reds
            114: '#0C2340', // Guardians
            115: '#C4CED4', // Rockies
            116: '#0C2C56', // Tigers
            117: '#006341', // Astros
            118: '#004687', // Royals
            119: '#FF6600', // Marlins
            120: '#182444', // Brewers
            121: '#002B5C', // Twins
            133: '#FF5910', // Athletics
            134: '#E31837', // Pirates
            135: '#002D62', // Padres
            136: '#005A2B', // Mariners
            137: '#C4CED4', // Giants
            138: '#003278', // Cardinals
            139: '#092C5C', // Rays
            140: '#003278', // Rangers
            141: '#134A8E', // Blue Jays
            142: '#002D62', // Twins
            143: '#C4161C', // Phillies
            144: '#CE1141', // Braves
            145: '#AB0003', // White Sox
            146: '#FF6600', // Marlins
            147: '#1E22AA', // Yankees
            158: '#002D62'  // Brewers
        };
        
        this.allTeams = [];
        this.allScheduleData = null;
        this.randomizerInterval = null;
        this.liveGamePollingInterval = null;
        this.currentActiveGame = null;
        
        this.init();
    }

    async init() {
        await this.loadTeams();
        await this.loadAllSchedules();
        this.setupEventListeners();
    }

    async loadTeams() {
        try {
            const response = await fetch('https://statsapi.mlb.com/api/v1/teams?sportId=1');
            const data = await response.json();
            
            const teams = data.teams.filter(team => 
                team.active && 
                team.sport.id === 1 && 
                team.league && 
                (team.league.id === 103 || team.league.id === 104)
            );
            teams.sort((a, b) => a.name.localeCompare(b.name));
            
            this.allTeams = teams; // Store teams for randomizer
            
            teams.forEach(team => {
                const option = document.createElement('option');
                option.value = team.id;
                option.textContent = team.name;
                this.teamSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading teams:', error);
        }
    }

    async loadAllSchedules() {
        try {
            const currentYear = new Date().getFullYear();
            const startDate = `${currentYear}-03-01`;
            const endDate = new Date().toISOString().split('T')[0];
            
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`
            );
            const data = await response.json();
            
            this.allScheduleData = data;
        } catch (error) {
            console.error('Error loading all schedules:', error);
            this.allScheduleData = null;
        }
    }

    setupEventListeners() {
        this.teamSelect.addEventListener('change', () => {
            this.findButton.disabled = !this.teamSelect.value;
        });

        this.findButton.addEventListener('click', () => {
            this.findBandwagonTeam();
        });
    }

    async findBandwagonTeam() {
        const startingTeamId = this.teamSelect.value;
        if (!startingTeamId) return;

        this.currentTeamId = startingTeamId;
        this.updateAccentColor(startingTeamId);
        this.startRandomizer();
        
        try {
            const bandwagonJourney = await this.traceBandwagon(startingTeamId);
            this.stopRandomizer();
            await this.displayResults(bandwagonJourney);
        } catch (error) {
            console.error('Error finding bandwagon team:', error);
            this.stopRandomizer();
            alert('Sorry, there was an error finding your bandwagon team. Please try again.');
        }
    }

    async traceBandwagon(startingTeamId) {
        const currentYear = new Date().getFullYear();
        const startDate = `${currentYear}-03-01`;
        const endDate = new Date().toISOString().split('T')[0];
        
        let currentTeamId = startingTeamId;
        const journey = [];
        let currentDate = startDate;
        
        this.initializeJourneyDisplay();
        
        while (new Date(currentDate) <= new Date(endDate)) {
            const currentTeam = await this.getTeamInfo(currentTeamId);
            const games = this.getAllGamesFromDate(currentTeamId, currentDate, endDate);
            
            if (games.length === 0) break;
            
            // Collect wins during this team's tenure
            const wins = [];
            let foundLoss = false;
            
            for (const game of games) {
                if (!game.teamWon) {
                    const opponentTeam = await this.getTeamInfo(game.opponentTeamId);
                    const journeyStep = {
                        losingTeam: currentTeam,
                        winningTeam: opponentTeam,
                        gameDate: game.gameDate,
                        score: game.score,
                        gameId: game.gameId,
                        gamePk: game.gamePk,
                        wins: wins // Include wins during this team's tenure
                    };
                    
                    journey.push(journeyStep);
                    this.addJourneyStep(journeyStep);
                    
                    currentTeamId = game.opponentTeamId;
                    currentDate = this.addDays(game.gameDate, 1);
                    foundLoss = true;
                    break;
                } else {
                    // This is a win - collect opponent info
                    const opponentTeam = await this.getTeamInfo(game.opponentTeamId);
                    wins.push({
                        gameDate: game.gameDate,
                        opponent: opponentTeam,
                        score: game.score,
                        isHome: game.isHome,
                        gameId: game.gameId,
                        gamePk: game.gamePk
                    });
                }
            }
            
            if (!foundLoss) break;
        }
        
        const finalTeam = await this.getTeamInfo(currentTeamId);
        this.currentFinalTeam = finalTeam;
        return { journey, finalTeam };
    }

    getTeamSchedule(teamId, startDate, endDate) {
        if (!this.allScheduleData) {
            console.error('All schedule data not loaded');
            return { dates: [] };
        }
        
        const teamGames = { dates: [] };
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        
        for (const date of this.allScheduleData.dates) {
            const dateObj = new Date(date.date);
            if (dateObj >= startDateObj && dateObj <= endDateObj) {
                const gamesForTeam = date.games.filter(game => 
                    game.teams.home.team.id == teamId || game.teams.away.team.id == teamId
                );
                
                if (gamesForTeam.length > 0) {
                    teamGames.dates.push({
                        date: date.date,
                        games: gamesForTeam
                    });
                }
            }
        }
        
        return teamGames;
    }
    
    getAllGamesFromDate(teamId, startDate, endDate) {
        try {
            const data = this.getTeamSchedule(teamId, startDate, endDate);
            if (!data) return [];
            
            const games = [];
            for (const date of data.dates) {
                for (const game of date.games) {
                    if (game.status.statusCode === 'F' && game.gameType === 'R' && 
                        new Date(game.gameDate) >= new Date(startDate)) {
                        const homeTeam = game.teams.home;
                        const awayTeam = game.teams.away;
                        
                        const teamIsHome = homeTeam.team.id == teamId;
                        const teamIsAway = awayTeam.team.id == teamId;
                        
                        if (teamIsHome || teamIsAway) {
                            const opponentTeamId = teamIsHome ? awayTeam.team.id : homeTeam.team.id;
                            const teamWon = (teamIsHome && homeTeam.score > awayTeam.score) || 
                                          (teamIsAway && awayTeam.score > homeTeam.score);
                            
                            games.push({
                                gameDate: game.gameDate.split('T')[0],
                                opponentTeamId,
                                teamWon,
                                score: teamIsHome ? 
                                    `${homeTeam.score}-${awayTeam.score}` : 
                                    `${awayTeam.score}-${homeTeam.score}`,
                                isHome: teamIsHome,
                                gameId: game.gamePk,
                                gamePk: game.gamePk
                            });
                        }
                    }
                }
            }
            
            return games.sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
        } catch (error) {
            console.error('Error getting games:', error);
            return [];
        }
    }
    
    findNextLoss(teamId, startDate, endDate) {
        const games = this.getAllGamesFromDate(teamId, startDate, endDate);
        
        for (const game of games) {
            if (!game.teamWon) {
                return {
                    winningTeamId: game.opponentTeamId,
                    gameDate: game.gameDate,
                    score: game.score
                };
            }
        }
        
        return null;
    }

    async getTeamInfo(teamId) {
        try {
            const response = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`);
            const data = await response.json();
            const teamInfo = data.teams[0];
            
            return teamInfo;
        } catch (error) {
            console.error('Error getting team info:', error);
            const fallback = { name: 'Unknown Team', id: teamId };
            return fallback;
        }
    }

    addDays(dateString, days) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    startRandomizer() {
        this.finalTeam.innerHTML = `
            <h3>Finding Your Team...</h3>
            <div class="final-team-display">
                <img id="randomizer-logo" src="${this.getTeamLogoUrl(108)}" alt="Team logo" class="final-team-logo randomizer-fade">
            </div>
        `;
        this.results.classList.remove('hidden');
        
        let currentIndex = 0;
        this.randomizerInterval = setInterval(() => {
            if (this.allTeams.length > 0) {
                const randomTeam = this.allTeams[currentIndex % this.allTeams.length];
                const logo = document.getElementById('randomizer-logo');
                
                if (logo) {
                    logo.src = this.getTeamLogoUrl(randomTeam.id);
                    logo.alt = `${randomTeam.name} logo`;
                }
                currentIndex++;
            }
        }, 150);
    }
    
    stopRandomizer() {
        if (this.randomizerInterval) {
            clearInterval(this.randomizerInterval);
            this.randomizerInterval = null;
        }
    }

    async displayResults(data) {
        // Check for active game
        const activeGame = await this.getActiveGame(data.finalTeam.id);
        this.currentActiveGame = activeGame;
        
        // Start live polling if there's an active game
        if (activeGame) {
            this.startLiveGamePolling(data);
        } else {
            this.stopLiveGamePolling();
        }
        
        // Get current win streak
        const winStreak = await this.getCurrentWinStreak(data.finalTeam.id);
        
        let gameEmbedHtml = '';
        if (activeGame) {
            const inningInfo = activeGame.inning && activeGame.inningState ? 
                `${activeGame.inningState} ${activeGame.inning}` : '';
            
            const live = activeGame.liveData;
            
            gameEmbedHtml = `
                <div class="gameday-embed">
                    <h4><a href="https://www.mlb.com/gameday/${activeGame.gamePk}" target="_blank" rel="noopener noreferrer" class="live-game-link">Live Game</a></h4>
                    <div class="game-card">
                        <div class="game-matchup">
                            <div class="team-side away-team">
                                <img src="${this.getTeamLogoUrl(activeGame.awayTeam.id)}" alt="${activeGame.awayTeam.name} logo" class="game-team-logo">
                                <div class="team-info">
                                    <div class="team-name">${activeGame.awayTeam.name}</div>
                                    <div class="team-record">Away</div>
                                </div>
                                <div class="team-score">${activeGame.awayTeam.score}</div>
                            </div>
                            
                            <div class="game-center">
                                <div class="game-status">${activeGame.status}</div>
                                ${inningInfo ? `<div class="inning-info">${inningInfo}</div>` : ''}
                                ${live ? this.renderGameState(live) : ''}
                            </div>
                            
                            <div class="team-side home-team">
                                <div class="team-score">${activeGame.homeTeam.score}</div>
                                <div class="team-info">
                                    <div class="team-name">${activeGame.homeTeam.name}</div>
                                    <div class="team-record">Home</div>
                                </div>
                                <img src="${this.getTeamLogoUrl(activeGame.homeTeam.id)}" alt="${activeGame.homeTeam.name} logo" class="game-team-logo">
                            </div>
                        </div>
                        ${live ? this.renderDetailedGameInfo(live) : ''}
                    </div>
                </div>
            `;
        }
        
        let winStreakHtml = '';
        if (winStreak && winStreak.length > 0) {
            const showingAllStreak = this.showingAllStreak || false;
            const streakToShow = showingAllStreak ? 
                [...winStreak].reverse() : 
                [...winStreak].slice(-3).reverse();
                
            winStreakHtml = `
                <div class="win-streak-display">
                    <h4>Current Win Streak: ${winStreak.length} ${winStreak.length === 1 ? 'Game' : 'Games'}</h4>
                    ${winStreak.length > 3 ? `
                        <div class="expand-controls">
                            <span class="journey-info">Showing last 3 of ${winStreak.length} games</span>
                            <button id="expand-streak" class="expand-btn">${showingAllStreak ? 'Show Last 3 ▲' : 'Show All ▼'}</button>
                        </div>
                    ` : ''}
                    <div class="win-streak-games">
                        ${streakToShow.map(game => `
                            <div class="team-step">
                                <div class="step-main">
                                    <div class="team-info">
                                        <img src="${this.getTeamLogoUrl(game.opponent.id)}" alt="${game.opponent.name} logo" class="team-logo">
                                        <div class="team-details">
                                            <div class="team-name">${game.opponent.name}</div>
                                            <div class="game-info">Won ${game.isHome ? 'vs' : '@'} ${game.opponent.name} on ${game.gameDate} (<a href="https://www.mlb.com/gameday/${game.gamePk}" target="_blank" rel="noopener noreferrer">${game.score}</a>)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        this.finalTeam.innerHTML = `
            <h3>Always Been A Fan Of The:</h3>
            <div class="final-team-display">
                <a href="https://www.mlb.com/${this.getTeamSlug(data.finalTeam.name)}" target="_blank" rel="noopener noreferrer">
                    <img src="${this.getTeamLogoUrl(data.finalTeam.id)}" alt="${data.finalTeam.name} logo" class="final-team-logo pulse">
                </a>
                <div class="final-team-name">${data.finalTeam.name}</div>
            </div>
            ${winStreakHtml}
            ${gameEmbedHtml}
        `;
        
        // Add click handler for win streak expand button
        if (winStreak && winStreak.length > 3) {
            const expandBtn = this.finalTeam.querySelector('#expand-streak');
            if (expandBtn) {
                expandBtn.addEventListener('click', () => {
                    this.toggleStreakView(data);
                });
            }
        }
    }
    
    async toggleStreakView(data) {
        this.showingAllStreak = !this.showingAllStreak;
        // Re-render the results to update the win streak display
        await this.displayResults(data);
    }
    
    renderJourneySteps() {
        const journeySteps = document.getElementById('journey-steps');
        journeySteps.innerHTML = '';
        
        const stepsToShow = this.showingAll ? 
            [...this.currentJourney].reverse() : 
            [...this.currentJourney].slice(-5).reverse();
        
        stepsToShow.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'team-step fade-in';
            stepElement.style.animationDelay = `${index * 0.1}s`;
            
            stepElement.innerHTML = `
                <div class="team-info">
                    <img src="${this.getTeamLogoUrl(step.losingTeam.id)}" alt="${step.losingTeam.name} logo" class="team-logo">
                    <div class="team-details">
                        <div class="team-name">${step.losingTeam.name}</div>
                        <div class="game-info">Lost to ${step.winningTeam.name} on ${step.gameDate} (${step.score})</div>
                    </div>
                </div>
                ${index < stepsToShow.length - 1 ? '<div class="arrow">↓</div>' : ''}
            `;
            
            journeySteps.appendChild(stepElement);
        });
    }
    
    toggleJourneyView() {
        this.showingAll = !this.showingAll;
        this.renderJourneySteps();
        
        const expandBtn = document.getElementById('expand-journey');
        const journeyInfo = document.querySelector('.journey-info');
        
        if (expandBtn && journeyInfo) {
            if (this.showingAll) {
                expandBtn.innerHTML = 'Show Last 5 \u25b2';
                journeyInfo.textContent = `Showing all ${this.currentJourney.length} steps`;
            } else {
                expandBtn.innerHTML = 'Show All \u25bc';
                journeyInfo.textContent = `Showing last 5 of ${this.currentJourney.length} steps`;
            }
        }
    }
    

    showLoading() {
        this.loading.classList.remove('hidden');
        this.results.classList.add('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }

    getTeamLogoUrl(teamId) {
        return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    }

    initializeJourneyDisplay() {
        this.teamChain.innerHTML = '';
        this.currentJourney = [];
        this.showingAll = false;
        
        const container = document.createElement('div');
        container.className = 'journey-container';
        
        const expandControls = document.createElement('div');
        expandControls.className = 'expand-controls';
        expandControls.style.display = 'none';
        expandControls.innerHTML = `
            <span class="journey-info">Showing last 5 of 0 steps</span>
            <button id="expand-journey" class="expand-btn">Show All ▼</button>
        `;
        container.appendChild(expandControls);
        
        const journeySteps = document.createElement('div');
        journeySteps.className = 'journey-steps';
        journeySteps.id = 'journey-steps';
        journeySteps.style.minHeight = '500px';
        container.appendChild(journeySteps);
        
        this.teamChain.appendChild(container);
        this.results.classList.remove('hidden');
        
        expandControls.querySelector('#expand-journey').addEventListener('click', () => {
            this.toggleJourneyView();
        });
    }
    
    addJourneyStep(step) {
        this.currentJourney.push(step);
        this.renderJourneySteps();
        
        const expandControls = document.querySelector('.expand-controls');
        if (this.currentJourney.length > 5 && expandControls) {
            expandControls.style.display = 'flex';
            const journeyInfo = expandControls.querySelector('.journey-info');
            if (journeyInfo) {
                journeyInfo.textContent = `Showing last 5 of ${this.currentJourney.length} steps`;
            }
        }
    }

    
    updateAccentColor(teamId) {
        const teamColor = this.teamColors[teamId] || '#4ade80';
        
        // Ensure the accent color is bright enough for readability
        const brightColor = this.ensureReadableColor(teamColor);
        
        document.documentElement.style.setProperty('--accent-color', brightColor);
        document.documentElement.style.setProperty('--accent-color-light', brightColor + '33');
        document.documentElement.style.setProperty('--accent-color-dark', brightColor + '66');
    }
    
    ensureReadableColor(hexColor) {
        // Convert hex to RGB
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        // Calculate luminance
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // If too dark, brighten it
        if (luminance < 0.4) {
            const factor = 0.4 / luminance;
            const newR = Math.min(255, Math.round(r * factor * 1.5));
            const newG = Math.min(255, Math.round(g * factor * 1.5));
            const newB = Math.min(255, Math.round(b * factor * 1.5));
            
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        }
        
        return hexColor;
    }
    
    renderJourneySteps() {
        const journeySteps = document.getElementById('journey-steps');
        journeySteps.innerHTML = '';
        
        const stepsToShow = this.showingAll ? 
            [...this.currentJourney].reverse() : 
            [...this.currentJourney].slice(-5).reverse();
        
        stepsToShow.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'team-step';
            
            const winsCount = step.wins ? step.wins.length : 0;
            
            stepElement.innerHTML = `
                <div class="step-main">
                    <div class="team-info">
                        <img src="${this.getTeamLogoUrl(step.losingTeam.id)}" alt="${step.losingTeam.name} logo" class="team-logo">
                        <div class="team-details">
                            <div class="team-name">${step.losingTeam.name}</div>
                            <div class="game-info">Lost to ${step.winningTeam.name} on ${step.gameDate} (<a href="https://www.mlb.com/gameday/${step.gamePk}" target="_blank" rel="noopener noreferrer">${step.score}</a>)</div>
                            ${winsCount > 0 ? `<div class="wins-toggle" data-step-index="${index}">Show wins ▼</div>` : `<div class="no-wins">(no wins)</div>`}
                        </div>
                    </div>
                </div>
                <div class="wins-submenu" id="wins-${index}" style="display: none;">
                    ${step.wins && step.wins.length > 0 ? this.renderWinsSubmenu(step.wins) : ''}
                </div>
            `;
            
            journeySteps.appendChild(stepElement);
            
            // Add click handler for wins toggle
            if (winsCount > 0) {
                const winsToggle = stepElement.querySelector('.wins-toggle');
                const winsSubmenu = stepElement.querySelector('.wins-submenu');
                
                winsToggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const isExpanded = winsSubmenu.style.display !== 'none';
                    
                    if (isExpanded) {
                        winsSubmenu.style.display = 'none';
                        winsToggle.innerHTML = `Show wins ▼`;
                        winsToggle.classList.remove('expanded');
                    } else {
                        winsSubmenu.style.display = 'block';
                        winsToggle.innerHTML = `Hide wins ▲`;
                        winsToggle.classList.add('expanded');
                    }
                });
            }
        });
    }
    
    renderWinsSubmenu(wins) {
        return wins.map(win => `
            <div class="win-game">
                <div class="win-game-info">
                    <img src="${this.getTeamLogoUrl(win.opponent.id)}" alt="${win.opponent.name} logo" class="win-opponent-logo">
                    <div class="win-details">
                        <div class="win-opponent">${win.isHome ? 'vs' : '@'} ${win.opponent.name}</div>
                        <div class="win-date">${win.gameDate} - <a href="https://www.mlb.com/gameday/${win.gamePk}" target="_blank" rel="noopener noreferrer">Won ${win.score}</a></div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    toggleJourneyView() {
        this.showingAll = !this.showingAll;
        this.renderJourneySteps();
        
        const expandBtn = document.getElementById('expand-journey');
        const journeyInfo = document.querySelector('.journey-info');
        
        if (expandBtn && journeyInfo) {
            if (this.showingAll) {
                expandBtn.innerHTML = 'Show Last 5 ▲';
                journeyInfo.textContent = `Showing all ${this.currentJourney.length} steps`;
            } else {
                expandBtn.innerHTML = 'Show All ▼';
                journeyInfo.textContent = `Showing last 5 of ${this.currentJourney.length} steps`;
            }
        }
    }

    getTeamColor(teamId) {
        return this.teamColors[teamId] || '#4ade80';
    }

    async getCurrentWinStreak(teamId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const endDate = today;
            const currentYear = new Date().getFullYear();
            const startDate = `${currentYear}-03-01`;
            
            const games = this.getAllGamesFromDate(teamId, startDate, endDate);
            
            // Get most recent completed games and work backwards to find win streak
            const recentGames = games.reverse(); // Most recent first
            const winStreak = [];
            
            for (const game of recentGames) {
                if (game.teamWon) {
                    const opponentTeam = await this.getTeamInfo(game.opponentTeamId);
                    winStreak.push({
                        gameDate: game.gameDate,
                        opponent: opponentTeam,
                        score: game.score,
                        isHome: game.isHome,
                        gamePk: game.gamePk
                    });
                } else {
                    // First loss breaks the streak
                    break;
                }
            }
            
            // Return wins in chronological order (oldest first)
            return winStreak.reverse();
        } catch (error) {
            console.error('Error getting current win streak:', error);
            return [];
        }
    }

    async getActiveGame(teamId) {
        try {
            const now = new Date();
            const today = now.getFullYear() + '-' + 
                         String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(now.getDate()).padStart(2, '0');
            
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&date=${today}&teamId=${teamId}&hydrate=team,linescore`
            );
            const data = await response.json();
            
            if (data.dates && data.dates.length > 0) {
                for (const date of data.dates) {
                    for (const game of date.games) {
                        const gameStatus = game.status.statusCode;
                        
                        // Check for games that are in progress only
                        // I = In Progress, PW = Pre-Game (Warmup), IR = Inning Review, etc.
                        if (gameStatus === 'I' || gameStatus === 'PW' || gameStatus === 'IR' || 
                            gameStatus === 'MA' || gameStatus === 'DR' || gameStatus === 'DI') {
                            
                            // Get detailed live data for in-progress games
                            const liveData = await this.getLiveGameData(game.gamePk);
                            
                            return {
                                gamePk: game.gamePk,
                                status: game.status.detailedState,
                                homeTeam: {
                                    id: game.teams.home.team.id,
                                    name: game.teams.home.team.name,
                                    score: game.teams.home.score || 0
                                },
                                awayTeam: {
                                    id: game.teams.away.team.id,
                                    name: game.teams.away.team.name,
                                    score: game.teams.away.score || 0
                                },
                                inning: game.linescore ? game.linescore.currentInning : null,
                                inningState: game.linescore ? game.linescore.inningState : null,
                                gameTime: game.gameDate,
                                liveData: liveData
                            };
                        }
                    }
                }
            }
            return null;
        } catch (error) {
            console.error('Error checking for active game:', error);
            return null;
        }
    }

    async getLiveGameData(gamePk) {
        try {
            // Try the live feed endpoint first
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`
            );
            const data = await response.json();
            
            console.log('Live game data response:', data); // Debug logging
            
            if (!data.liveData) {
                console.log('No liveData found, trying alternative structure...');
                return this.extractLiveDataAlternative(data);
            }
            
            const plays = data.liveData.plays;
            const linescore = data.liveData.linescore;
            
            console.log('Current play:', plays?.currentPlay); // Debug logging
            
            // Extract current game state
            const liveGameData = {
                balls: plays?.currentPlay?.count?.balls || 0,
                strikes: plays?.currentPlay?.count?.strikes || 0,
                outs: plays?.currentPlay?.count?.outs || 0,
                currentBatter: plays?.currentPlay?.matchup?.batter ? {
                    id: plays.currentPlay.matchup.batter.id,
                    fullName: plays.currentPlay.matchup.batter.fullName || 'Unknown'
                } : null,
                currentPitcher: plays?.currentPlay?.matchup?.pitcher ? {
                    id: plays.currentPlay.matchup.pitcher.id,
                    fullName: plays.currentPlay.matchup.pitcher.fullName || 'Unknown'
                } : null,
                pitchCount: plays?.currentPlay?.pitchNumber || 0,
                inning: linescore?.currentInning || null,
                inningState: linescore?.inningState || null
            };
            
            console.log('Extracted live game data:', liveGameData); // Debug logging
            return liveGameData;
        } catch (error) {
            console.error('Error getting live game data:', error);
            return null;
        }
    }
    
    extractLiveDataAlternative(data) {
        // Try to extract from different possible structures
        try {
            const gameData = data.gameData || data;
            const liveData = data.liveData || {};
            
            // Basic fallback with minimal data
            return {
                balls: 0,
                strikes: 0,
                outs: 0,
                currentBatter: null,
                currentPitcher: null,
                pitchCount: 0,
                inning: null,
                inningState: null
            };
        } catch (error) {
            console.error('Error in alternative extraction:', error);
            return null;
        }
    }
    
    renderGameState(live) {
        if (!live) {
            return `
                <div class="count-display">
                    <div class="count-item">
                        <span class="count-label">Loading live data...</span>
                    </div>
                </div>
            `;
        }
        
        // Hide count/outs when: 3 outs, 3 strikes, 4 balls, or end of inning
        const shouldHideCount = live.outs >= 3 || live.strikes >= 3 || live.balls >= 4 || 
                               (live.inningState && live.inningState.toLowerCase().includes('end'));
        const hiddenClass = shouldHideCount ? ' hidden-content' : '';
        
        return `
            <div class="count-display">
                <div class="count-item${hiddenClass}">
                    <span class="count-label">Count</span>
                    <span class="count-value">${live.balls}-${live.strikes}</span>
                </div>
                <div class="count-item${hiddenClass}">
                    <span class="count-label">Outs</span>
                    <span class="count-value">${live.outs}</span>
                </div>
            </div>
        `;
    }
    
    renderDetailedGameInfo(live) {
        if (!live) {
            return `
                <div class="live-game-details">
                    <div class="loading-live-data">
                        <p>Loading detailed game data...</p>
                    </div>
                </div>
            `;
        }
        
        const playersHtml = this.renderCurrentPlayers(live);
        
        return `
            <div class="live-game-details">
                ${playersHtml}
            </div>
        `;
    }
    
    renderCurrentPlayers(live) {
        if (!live.currentBatter && !live.currentPitcher) return '';
        
        return `
            <div class="current-players">
                ${live.currentBatter ? `
                    <div class="player-info">
                        <span class="player-label">Batting:</span>
                        <span class="player-name">${live.currentBatter.fullName}</span>
                    </div>
                ` : ''}
                ${live.currentPitcher ? `
                    <div class="player-info">
                        <span class="player-label">Pitching:</span>
                        <span class="player-name">${live.currentPitcher.fullName}</span>
                    </div>
                ` : ''}
                ${live.pitchCount > 0 ? `
                    <div class="player-info">
                        <span class="player-label">Pitch Count:</span>
                        <span class="player-name">${live.pitchCount}</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    startLiveGamePolling(data) {
        // Clear any existing polling
        this.stopLiveGamePolling();
        
        this.liveGamePollingInterval = setInterval(async () => {
            try {
                const updatedGame = await this.getActiveGame(data.finalTeam.id);
                
                if (updatedGame) {
                    // Game is still active, update the display
                    if (this.gameStatusChanged(this.currentActiveGame, updatedGame)) {
                        this.currentActiveGame = updatedGame;
                        await this.updateLiveGameDisplay(updatedGame, data);
                    }
                } else {
                    // Game has ended, stop polling and refresh bandwagon if needed
                    this.stopLiveGamePolling();
                    await this.handleGameCompletion(data);
                }
            } catch (error) {
                console.error('Error during live game polling:', error);
            }
        }, 5000); // Poll every 5 seconds
    }
    
    stopLiveGamePolling() {
        if (this.liveGamePollingInterval) {
            clearInterval(this.liveGamePollingInterval);
            this.liveGamePollingInterval = null;
        }
    }
    
    gameStatusChanged(oldGame, newGame) {
        if (!oldGame || !newGame) return true;
        
        return oldGame.homeTeam.score !== newGame.homeTeam.score ||
               oldGame.awayTeam.score !== newGame.awayTeam.score ||
               oldGame.status !== newGame.status ||
               oldGame.inning !== newGame.inning ||
               oldGame.inningState !== newGame.inningState;
    }
    
    async updateLiveGameDisplay(activeGame, data) {
        const gameEmbedElement = document.querySelector('.gameday-embed');
        if (!gameEmbedElement) return;
        
        const inningInfo = activeGame.inning && activeGame.inningState ? 
            `${activeGame.inningState} ${activeGame.inning}` : '';
        
        const live = activeGame.liveData;
        
        gameEmbedElement.innerHTML = `
            <h4><a href="https://www.mlb.com/gameday/${activeGame.gamePk}" target="_blank" rel="noopener noreferrer" class="live-game-link">Live Game</a></h4>
            <div class="game-card">
                <div class="game-matchup">
                    <div class="team-side away-team">
                        <img src="${this.getTeamLogoUrl(activeGame.awayTeam.id)}" alt="${activeGame.awayTeam.name} logo" class="game-team-logo">
                        <div class="team-info">
                            <div class="team-name">${activeGame.awayTeam.name}</div>
                            <div class="team-record">Away</div>
                        </div>
                        <div class="team-score">${activeGame.awayTeam.score}</div>
                    </div>
                    
                    <div class="game-center">
                        <div class="game-status">${activeGame.status}</div>
                        ${inningInfo ? `<div class="inning-info">${inningInfo}</div>` : ''}
                        ${live ? this.renderGameState(live) : ''}
                    </div>
                    
                    <div class="team-side home-team">
                        <div class="team-score">${activeGame.homeTeam.score}</div>
                        <div class="team-info">
                            <div class="team-name">${activeGame.homeTeam.name}</div>
                            <div class="team-record">Home</div>
                        </div>
                        <img src="${this.getTeamLogoUrl(activeGame.homeTeam.id)}" alt="${activeGame.homeTeam.name} logo" class="game-team-logo">
                    </div>
                </div>
                ${live ? this.renderDetailedGameInfo(live) : ''}
            </div>
        `;
    }
    
    async handleGameCompletion(data) {
        // Reload schedule data to include the just-completed game
        await this.loadAllSchedules();
        
        // Check if the game result affects the bandwagon path
        const currentTeamId = data.finalTeam.id;
        const today = new Date().toISOString().split('T')[0];
        
        // Check for any new losses since the last bandwagon calculation
        const recentGames = this.getAllGamesFromDate(currentTeamId, today, today);
        const newLoss = recentGames.find(game => !game.teamWon);
        
        if (newLoss) {
            // The team lost! Need to extend the bandwagon path
            const newWinningTeam = await this.getTeamInfo(newLoss.opponentTeamId);
            
            // Add a visual indicator that the bandwagon has changed
            const gameEmbedElement = document.querySelector('.gameday-embed');
            if (gameEmbedElement) {
                gameEmbedElement.innerHTML = `
                    <div class="game-completed-alert">
                        <h4>🚨 Game Completed - Bandwagon Updated!</h4>
                        <p>${data.finalTeam.name} lost to ${newWinningTeam.name}!</p>
                        <p>Your new bandwagon team is: <strong>${newWinningTeam.name}</strong></p>
                        <button onclick="location.reload()" class="refresh-btn">Refresh to see full updated path</button>
                    </div>
                `;
            }
        } else {
            // Team won or no game today, just remove the live game display
            const gameEmbedElement = document.querySelector('.gameday-embed');
            if (gameEmbedElement) {
                gameEmbedElement.remove();
            }
            
            // Refresh win streak display
            const winStreak = await this.getCurrentWinStreak(data.finalTeam.id);
            if (winStreak && winStreak.length > 0) {
                await this.displayResults(data);
            }
        }
    }
    
    getTeamSlug(teamName) {
        const slugMap = {
            'Arizona Diamondbacks': 'dbacks',
            'Atlanta Braves': 'braves',
            'Baltimore Orioles': 'orioles',
            'Boston Red Sox': 'redsox',
            'Chicago Cubs': 'cubs',
            'Chicago White Sox': 'whitesox',
            'Cincinnati Reds': 'reds',
            'Cleveland Guardians': 'guardians',
            'Colorado Rockies': 'rockies',
            'Detroit Tigers': 'tigers',
            'Houston Astros': 'astros',
            'Kansas City Royals': 'royals',
            'Los Angeles Angels': 'angels',
            'Los Angeles Dodgers': 'dodgers',
            'Miami Marlins': 'marlins',
            'Milwaukee Brewers': 'brewers',
            'Minnesota Twins': 'twins',
            'New York Mets': 'mets',
            'New York Yankees': 'yankees',
            'Oakland Athletics': 'athletics',
            'Philadelphia Phillies': 'phillies',
            'Pittsburgh Pirates': 'pirates',
            'San Diego Padres': 'padres',
            'San Francisco Giants': 'giants',
            'Seattle Mariners': 'mariners',
            'St. Louis Cardinals': 'cardinals',
            'Tampa Bay Rays': 'rays',
            'Texas Rangers': 'rangers',
            'Toronto Blue Jays': 'bluejays',
            'Washington Nationals': 'nationals'
        };
        return slugMap[teamName] || teamName.toLowerCase().replace(/\s+/g, '');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MLBBandwagon();
});