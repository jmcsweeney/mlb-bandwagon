class MLBBandwagon {
    constructor() {
        this.teamSelect = document.getElementById('team-select');
        this.findButton = document.getElementById('find-bandwagon');
        this.loading = document.getElementById('loading');
        this.results = document.getElementById('results');
        this.teamChain = document.getElementById('team-chain');
        this.finalTeam = document.getElementById('final-team');
        
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
            
            const nextLoss = await this.findNextLoss(currentTeamId, currentDate, endDate);
            
            if (!nextLoss) break;
            
            const winningTeam = await this.getTeamInfo(nextLoss.winningTeamId);
            const losingTeam = await this.getTeamInfo(currentTeamId);
            
            journey.push({
                losingTeam: losingTeam,
                winningTeam: winningTeam,
                gameDate: nextLoss.gameDate,
                score: nextLoss.score
            });
            
            await this.animateTeamTransition(losingTeam, winningTeam);
            
            currentTeamId = nextLoss.winningTeamId;
            currentDate = this.addDays(nextLoss.gameDate, 1);
        }
        
        const finalTeam = await this.getTeamInfo(currentTeamId);
        this.currentFinalTeam = finalTeam;
        return { journey, finalTeam };
    }

    async findNextLoss(teamId, startDate, endDate) {
        try {
            const response = await fetch(
                `https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&gameType=R`
            );
            const data = await response.json();
            
            for (const date of data.dates) {
                for (const game of date.games) {
                    if (game.status.statusCode === 'F' && game.gameType === 'R') {
                        const homeTeam = game.teams.home;
                        const awayTeam = game.teams.away;
                        
                        const teamIsHome = homeTeam.team.id == teamId;
                        const teamIsAway = awayTeam.team.id == teamId;
                        
                        if (teamIsHome && homeTeam.score < awayTeam.score) {
                            return {
                                winningTeamId: awayTeam.team.id,
                                gameDate: game.gameDate.split('T')[0],
                                score: `${awayTeam.score}-${homeTeam.score}`
                            };
                        } else if (teamIsAway && awayTeam.score < homeTeam.score) {
                            return {
                                winningTeamId: homeTeam.team.id,
                                gameDate: game.gameDate.split('T')[0],
                                score: `${homeTeam.score}-${awayTeam.score}`
                            };
                        }
                    }
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error finding next loss:', error);
            return null;
        }
    }

    async getTeamInfo(teamId) {
        try {
            const response = await fetch(`https://statsapi.mlb.com/api/v1/teams/${teamId}`);
            const data = await response.json();
            return data.teams[0];
        } catch (error) {
            console.error('Error getting team info:', error);
            return { name: 'Unknown Team', id: teamId };
        }
    }

    addDays(dateString, days) {
        const date = new Date(dateString);
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    }

    displayResults(data) {
        this.teamChain.innerHTML = '';
        
        const totalSteps = data.journey.length;
        const showExpanded = totalSteps <= 5;
        const stepsToShow = showExpanded ? data.journey : data.journey.slice(-5);
        
        if (!showExpanded) {
            const expandButton = document.createElement('div');
            expandButton.className = 'expand-button';
            expandButton.innerHTML = `
                <button id="expand-journey">Show Full Journey (${totalSteps} steps) ▼</button>
                <div class="journey-summary">
                    Showing last 5 steps of ${totalSteps} total
                </div>
            `;
            this.teamChain.appendChild(expandButton);
            
            expandButton.querySelector('#expand-journey').addEventListener('click', () => {
                this.displayFullJourney(data.journey);
            });
        }
        
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
            
            this.teamChain.appendChild(stepElement);
        });
        
        this.finalTeam.innerHTML = `
            <h3>Your Bandwagon Team:</h3>
            <div class="final-team-display">
                <img src="${this.getTeamLogoUrl(data.finalTeam.id)}" alt="${data.finalTeam.name} logo" class="final-team-logo pulse">
                <div class="final-team-name">${data.finalTeam.name}</div>
            </div>
        `;
        
        this.results.classList.remove('hidden');
    }
    
    displayFullJourney(journey) {
        const expandButton = this.teamChain.querySelector('.expand-button');
        if (expandButton) {
            expandButton.remove();
        }
        
        const collapseButton = document.createElement('div');
        collapseButton.className = 'expand-button';
        collapseButton.innerHTML = `
            <button id="collapse-journey">Show Recent Steps Only ▲</button>
            <div class="journey-summary">
                Showing all ${journey.length} steps
            </div>
        `;
        this.teamChain.insertBefore(collapseButton, this.teamChain.firstChild);
        
        collapseButton.querySelector('#collapse-journey').addEventListener('click', () => {
            this.displayResults({ journey, finalTeam: this.currentFinalTeam });
        });
        
        const existingSteps = this.teamChain.querySelectorAll('.team-step');
        existingSteps.forEach(step => step.remove());
        
        journey.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'team-step fade-in';
            stepElement.style.animationDelay = `${index * 0.05}s`;
            
            stepElement.innerHTML = `
                <div class="team-info">
                    <img src="${this.getTeamLogoUrl(step.losingTeam.id)}" alt="${step.losingTeam.name} logo" class="team-logo">
                    <div class="team-details">
                        <div class="team-name">${step.losingTeam.name}</div>
                        <div class="game-info">Lost to ${step.winningTeam.name} on ${step.gameDate} (${step.score})</div>
                    </div>
                </div>
                ${index < journey.length - 1 ? '<div class="arrow">↓</div>' : ''}
            `;
            
            this.teamChain.appendChild(stepElement);
        });
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
            <div class="current-team-display">
                <img id="current-team-logo" src="" alt="" class="current-team-logo">
                <div id="current-team-name" class="current-team-name"></div>
            </div>
        `;
        
        this.loading.appendChild(progressDiv);
    }

    showCurrentTeam(team) {
        const logo = document.getElementById('current-team-logo');
        const name = document.getElementById('current-team-name');
        
        if (logo && name) {
            logo.src = this.getTeamLogoUrl(team.id);
            logo.alt = `${team.name} logo`;
            name.textContent = team.name;
            
            logo.classList.add('team-highlight');
            setTimeout(() => logo.classList.remove('team-highlight'), 800);
        }
    }

    async animateTeamTransition(losingTeam, winningTeam) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.showCurrentTeam(winningTeam);
                resolve();
            }, 400);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MLBBandwagon();
});