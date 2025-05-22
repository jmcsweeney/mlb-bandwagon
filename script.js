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
        
        while (new Date(currentDate) <= new Date(endDate)) {
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
            
            currentTeamId = nextLoss.winningTeamId;
            currentDate = this.addDays(nextLoss.gameDate, 1);
        }
        
        const finalTeam = await this.getTeamInfo(currentTeamId);
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
        
        data.journey.forEach((step, index) => {
            const stepElement = document.createElement('div');
            stepElement.className = 'team-step';
            
            stepElement.innerHTML = `
                <div class="team-info">
                    <div class="team-name">${step.losingTeam.name}</div>
                    <div class="game-info">Lost to ${step.winningTeam.name} on ${step.gameDate} (${step.score})</div>
                </div>
                ${index < data.journey.length - 1 ? '<div class="arrow">↓</div>' : ''}
            `;
            
            this.teamChain.appendChild(stepElement);
        });
        
        this.finalTeam.innerHTML = `
            <h3>Your Bandwagon Team:</h3>
            <div style="font-size: 1.8rem; font-weight: bold; margin-top: 0.5rem;">
                ${data.finalTeam.name}
            </div>
        `;
        
        this.results.classList.remove('hidden');
    }

    showLoading() {
        this.loading.classList.remove('hidden');
        this.results.classList.add('hidden');
    }

    hideLoading() {
        this.loading.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MLBBandwagon();
});