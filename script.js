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
        
        this.scheduleCache = new Map();
        this.teamInfoCache = new Map();
        
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
        this.showLoading();
        
        try {
            const bandwagonJourney = await this.traceBandwagon(startingTeamId);
            this.displayResults(bandwagonJourney);
        } catch (error) {
            console.error('Error finding bandwagon team:', error);
            alert('Sorry, there was an error finding your bandwagon team. Please try again.');
        }
        
        this.hideLoading();
    }

    async traceBandwagon(startingTeamId) {
        const currentYear = new Date().getFullYear();
        const startDate = `${currentYear}-03-01`;
        const endDate = new Date().toISOString().split('T')[0];
        
        let currentTeamId = startingTeamId;
        const journey = [];
        let currentDate = startDate;
        
        this.initializeProgressDisplay();
        
        while (new Date(currentDate) <= new Date(endDate)) {
            const currentTeam = await this.getTeamInfo(currentTeamId);
            this.showCurrentTeam(currentTeam);
            
            const games = await this.getAllGamesFromDate(currentTeamId, currentDate, endDate);
            
            if (games.length === 0) break;
            
            let foundLoss = false;
            for (const game of games) {
                const opponentTeam = await this.getTeamInfo(game.opponentTeamId);
                
                this.showOpposingTeam(opponentTeam);
                await this.animateGameResult(currentTeam, opponentTeam, game.teamWon);
                
                if (!game.teamWon) {
                    journey.push({
                        losingTeam: currentTeam,
                        winningTeam: opponentTeam,
                        gameDate: game.gameDate,
                        score: game.score
                    });
                    
                    await this.animateTeamTransition(currentTeam, opponentTeam);
                    
                    currentTeamId = game.opponentTeamId;
                    currentDate = this.addDays(game.gameDate, 1);
                    foundLoss = true;
                    break;
                }
            }
            
            if (!foundLoss) break;
        }
        
        const finalTeam = await this.getTeamInfo(currentTeamId);
        this.currentFinalTeam = finalTeam;
        return { journey, finalTeam };
    }

    async getTeamSchedule(teamId, startDate, endDate) {
        const cacheKey = `${teamId}-${startDate}-${endDate}`;
        
        if (this.scheduleCache.has(cacheKey)) {
            return this.scheduleCache.get(cacheKey);
        }
        
        try {
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&gameType=R`
            );
            const data = await response.json();
            
            this.scheduleCache.set(cacheKey, data);
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
        if (this.teamInfoCache.has(teamId)) {
            return this.teamInfoCache.get(teamId);
        }
        
        try {
            const response = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`);
            const data = await response.json();
            const teamInfo = data.teams[0];
            
            this.teamInfoCache.set(teamId, teamInfo);
            return teamInfo;
        } catch (error) {
            console.error('Error getting team info:', error);
            const fallback = { name: 'Unknown Team', id: teamId };
            this.teamInfoCache.set(teamId, fallback);
            return fallback;
        }
    }

    addDays(dateString, days) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    displayResults(data) {
        this.teamChain.innerHTML = '';
        this.currentJourney = data.journey;
        this.showingAll = false;
        
        const container = document.createElement('div');
        container.className = 'journey-container';
        
        if (data.journey.length > 5) {
            const expandControls = document.createElement('div');
            expandControls.className = 'expand-controls';
            expandControls.innerHTML = `
                <span class="journey-info">Showing last 5 of ${data.journey.length} steps</span>
                <button id="expand-journey" class="expand-btn">Show All ▼</button>
            `;
            container.appendChild(expandControls);
            
            expandControls.querySelector('#expand-journey').addEventListener('click', () => {
                this.toggleJourneyView();
            });
        }
        
        const journeySteps = document.createElement('div');
        journeySteps.className = 'journey-steps';
        journeySteps.id = 'journey-steps';
        container.appendChild(journeySteps);
        
        this.teamChain.appendChild(container);
        this.renderJourneySteps();
        
        this.finalTeam.innerHTML = `
            <h3>Your Bandwagon Team:</h3>
            <div class="final-team-display">
                <img src="${this.getTeamLogoUrl(data.finalTeam.id)}" alt="${data.finalTeam.name} logo" class="final-team-logo pulse">
                <div class="final-team-name">${data.finalTeam.name}</div>
            </div>
        `;
        
        this.results.classList.remove('hidden');
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
        const progressDisplay = document.getElementById('progress-display');
        if (progressDisplay) {
            progressDisplay.remove();
        }
    }

    getTeamLogoUrl(teamId) {
        return `https://www.mlbstatic.com/team-logos/${teamId}.svg`;
    }

    initializeProgressDisplay() {
        const progressDiv = document.createElement('div');
        progressDiv.id = 'progress-display';
        progressDiv.className = 'progress-display';
        progressDiv.innerHTML = `
            <h3>Following the journey...</h3>
            <div class="team-battle">
                <div class="team-side your-team">
                    <div class="team-label">YOUR PERFECT TEAM</div>
                    <div class="team-display">
                        <img id="current-team-logo" src="" alt="" class="battle-team-logo">
                        <div id="current-team-name" class="battle-team-name"></div>
                    </div>
                </div>
                <div class="vs-divider">VS</div>
                <div class="team-side opposing-team">
                    <div class="team-label">THOSE DASTARDLY OTHERS</div>
                    <div class="team-display">
                        <img id="opposing-team-logo" src="" alt="" class="battle-team-logo">
                        <div id="opposing-team-name" class="battle-team-name"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.loading.appendChild(progressDiv);
    }

    showCurrentTeam(team) {
        const logo = document.getElementById('current-team-logo');
        const name = document.getElementById('current-team-name');
        
        if (logo && name) {
            logo.style.opacity = '0';
            name.style.opacity = '0';
            
            setTimeout(() => {
                logo.src = this.getTeamLogoUrl(team.id);
                logo.alt = `${team.name} logo`;
                name.textContent = team.name;
                
                logo.style.opacity = '1';
                name.style.opacity = '1';
                logo.classList.add('team-highlight');
                setTimeout(() => logo.classList.remove('team-highlight'), 800);
            }, 150);
        }
    }
    
    showOpposingTeam(team) {
        const logo = document.getElementById('opposing-team-logo');
        const name = document.getElementById('opposing-team-name');
        
        if (logo && name) {
            logo.style.opacity = '0';
            name.style.opacity = '0';
            
            setTimeout(() => {
                logo.src = this.getTeamLogoUrl(team.id);
                logo.alt = `${team.name} logo`;
                name.textContent = team.name;
                
                logo.style.opacity = '1';
                name.style.opacity = '1';
                logo.classList.add('opposing-highlight');
                setTimeout(() => logo.classList.remove('opposing-highlight'), 800);
            }, 300);
        }
    }

    async animateGameResult(currentTeam, opponentTeam, teamWon) {
        return new Promise(resolve => {
            const currentLogo = document.getElementById('current-team-logo');
            const opposingLogo = document.getElementById('opposing-team-logo');
            
            if (teamWon) {
                currentLogo.classList.add('winner-glow');
                opposingLogo.classList.add('loser-fade');
            } else {
                currentLogo.classList.add('loser-fade');
                opposingLogo.classList.add('winner-glow');
            }
            
            setTimeout(() => {
                if (currentLogo) currentLogo.classList.remove('winner-glow', 'loser-fade');
                if (opposingLogo) opposingLogo.classList.remove('winner-glow', 'loser-fade');
                resolve();
            }, 800);
        });
    }
    
    async animateTeamTransition(losingTeam, winningTeam) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.currentTeamId = winningTeam.id;
                this.updateAccentColor(winningTeam.id);
                this.showCurrentTeam(winningTeam);
                resolve();
            }, 200);
        });
    }
    
    updateAccentColor(teamId) {
        const teamColor = this.teamColors[teamId] || '#4ade80';
        document.documentElement.style.setProperty('--accent-color', teamColor);
        document.documentElement.style.setProperty('--accent-color-light', teamColor + '33');
        document.documentElement.style.setProperty('--accent-color-dark', teamColor + '66');
    }
    
    getTeamColor(teamId) {
        return this.teamColors[teamId] || '#4ade80';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MLBBandwagon();
});