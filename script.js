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
        this.randomizerInterval = null;
        
        this.init();
    }

    async init() {
        await this.loadTeams();
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
            this.displayResults(bandwagonJourney);
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
            const games = await this.getAllGamesFromDate(currentTeamId, currentDate, endDate);
            
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
                        isHome: game.isHome
                    });
                }
            }
            
            if (!foundLoss) break;
        }
        
        const finalTeam = await this.getTeamInfo(currentTeamId);
        this.currentFinalTeam = finalTeam;
        return { journey, finalTeam };
    }

    async getTeamSchedule(teamId, startDate, endDate) {
        try {
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&gameType=R`
            );
            const data = await response.json();
            
            return data;
        } catch (error) {
            console.error('Error fetching team schedule:', error);
            return null;
        }
    }
    
    async getAllGamesFromDate(teamId, startDate, endDate) {
        try {
            const data = await this.getTeamSchedule(teamId, startDate, endDate);
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
                                isHome: teamIsHome
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
    
    async findNextLoss(teamId, startDate, endDate) {
        const games = await this.getAllGamesFromDate(teamId, startDate, endDate);
        
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
            <h3>Finding Your Bandwagon Team...</h3>
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

    displayResults(data) {
        this.finalTeam.innerHTML = `
            <h3>Your Bandwagon Team:</h3>
            <div class="final-team-display">
                <img src="${this.getTeamLogoUrl(data.finalTeam.id)}" alt="${data.finalTeam.name} logo" class="final-team-logo pulse">
                <div class="final-team-name">${data.finalTeam.name}</div>
            </div>
        `;
    }
    
    renderJourneySteps() {
        const journeySteps = document.getElementById('journey-steps');
        journeySteps.innerHTML = '';
        
        const stepsToShow = this.showingAll ? 
            this.currentJourney : 
            this.currentJourney.slice(-5);
        
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
            this.currentJourney : 
            this.currentJourney.slice(-5);
        
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
                            <div class="game-info">Lost to ${step.winningTeam.name} on ${step.gameDate} (${step.score})</div>
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
                        <div class="win-date">${win.gameDate} - Won ${win.score}</div>
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
}

document.addEventListener('DOMContentLoaded', () => {
    new MLBBandwagon();
});