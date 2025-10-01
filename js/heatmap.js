// Activity Heatmap JavaScript
// Add to js/heatmap.js

class ActivityHeatmap {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentYear = new Date().getFullYear();
        this.albums = [];
    }

    // Load all albums and generate heatmap
    async loadAndRender() {
        try {
            const snapshot = await db.collection('albums').get();
            
            this.albums = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.createdAt) {
                    this.albums.push({
                        id: doc.id,
                        title: data.title,
                        artist: data.artist,
                        coverImage: data.coverImage,
                        date: data.createdAt.toDate(),
                        score: data.averageScore || 0,
                        isCompleted: data.isCompleted
                    });
                }
            });

            this.render();
        } catch (error) {
            console.error('Error loading heatmap data:', error);
        }
    }

    // Generate the heatmap HTML
    render() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const today = new Date();
        
        // Calculate activity by date
        const activityMap = this.calculateActivityMap();

        let html = `
            <div class="heatmap-header">
                <h2>📅 Party Activity</h2>
                <div class="year-selector">
                    <button class="year-btn" onclick="heatmap.changeYear(-1)">←</button>
                    <span class="current-year">${this.currentYear}</span>
                    <button class="year-btn" onclick="heatmap.changeYear(1)">→</button>
                </div>
            </div>
            <div class="heatmap-grid">
        `;

        // Generate grid for all months
        for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(this.currentYear, month + 1, 0).getDate();
            
            html += `<div class="month-column">`;
            html += `<div class="month-label">${months[month]}</div>`;
            html += `<div class="days-grid">`;

            // Generate days
            for (let day = 1; day <= daysInMonth; day++) {
                const dateStr = `${this.currentYear}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const activity = activityMap[dateStr] || { count: 0, albums: [] };
                const isPast = new Date(this.currentYear, month, day) <= today;
                const isFuture = new Date(this.currentYear, month, day) > today;
                
                let intensity = 'empty';
                if (activity.count > 0) {
                    if (activity.count === 1) intensity = 'low';
                    else if (activity.count === 2) intensity = 'medium';
                    else if (activity.count === 3) intensity = 'high';
                    else intensity = 'highest';
                }

                const tooltip = activity.count > 0 
                    ? activity.albums.map(a => a.title).join(', ')
                    : 'No parties';

                html += `
                    <div class="day-cell ${intensity} ${isFuture ? 'future' : ''}" 
                         data-date="${dateStr}"
                         data-count="${activity.count}"
                         data-tooltip="${tooltip}"
                         onclick="heatmap.showDayDetails('${dateStr}')">
                        ${activity.count > 0 ? '<div class="pulse"></div>' : ''}
                    </div>
                `;
            }

            html += `</div></div>`;
        }

        html += `</div>`;

        // Legend
        html += `
            <div class="heatmap-legend">
                <span class="legend-label">Less</span>
                <div class="legend-cell empty"></div>
                <div class="legend-cell low"></div>
                <div class="legend-cell medium"></div>
                <div class="legend-cell high"></div>
                <div class="legend-cell highest"></div>
                <span class="legend-label">More</span>
            </div>
        `;

        // Stats
        const totalParties = this.albums.filter(a => 
            a.date.getFullYear() === this.currentYear
        ).length;

        html += `
            <div class="heatmap-stats">
                <div class="stat-item">
                    <span class="stat-value">${totalParties}</span>
                    <span class="stat-label">albums in ${this.currentYear}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${Object.keys(activityMap).length}</span>
                    <span class="stat-label">total parties</span>
                </div>
            </div>
        `;

        this.container.innerHTML = html;

        // Add tooltip functionality
        this.attachTooltips();
    }

    // Calculate activity count per date
    calculateActivityMap() {
        const map = {};

        this.albums.forEach(album => {
            if (album.date.getFullYear() !== this.currentYear) return;

            const dateStr = album.date.toISOString().split('T')[0];
            
            if (!map[dateStr]) {
                map[dateStr] = { count: 0, albums: [] };
            }

            map[dateStr].count++;
            map[dateStr].albums.push(album);
        });

        return map;
    }

    // Attach tooltip hover functionality
    attachTooltips() {
        const cells = this.container.querySelectorAll('.day-cell');
        
        cells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                const tooltip = e.target.dataset.tooltip;
                const count = e.target.dataset.count;
                
                if (count > 0) {
                    this.showTooltip(e.target, tooltip, count);
                }
            });

            cell.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    // Show tooltip
    showTooltip(element, text, count) {
        let tooltip = document.getElementById('heatmap-tooltip');
        
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'heatmap-tooltip';
            tooltip.className = 'heatmap-tooltip';
            document.body.appendChild(tooltip);
        }

        const rect = element.getBoundingClientRect();
        const partyText = count == 1 ? 'party' : 'parties';
        
        tooltip.innerHTML = `
            <strong>${count} ${partyText}</strong><br>
            ${text}
        `;
        
        tooltip.style.display = 'block';
        tooltip.style.left = rect.left + rect.width / 2 + 'px';
        tooltip.style.top = rect.top - 10 + 'px';
        tooltip.style.opacity = '1';
    }

    // Hide tooltip
    hideTooltip() {
        const tooltip = document.getElementById('heatmap-tooltip');
        if (tooltip) {
            tooltip.style.opacity = '0';
            setTimeout(() => tooltip.style.display = 'none', 200);
        }
    }

    // Show details for a specific day
    showDayDetails(dateStr) {
        const activityMap = this.calculateActivityMap();
        const activity = activityMap[dateStr];

        if (!activity || activity.count === 0) return;

        // Create modal with day's albums
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';

        const date = new Date(dateStr);
        const dateFormatted = date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📅 ${dateFormatted}</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="day-albums">
                    ${activity.albums.map(album => `
                        <div class="day-album-card" onclick="window.location.href='pages/albums.html?id=${album.id}'">
                            <div class="day-album-cover">
                                ${album.coverImage 
                                    ? `<img src="${album.coverImage}" alt="${album.title}">` 
                                    : '<div class="album-placeholder">🎵</div>'
                                }
                            </div>
                            <div class="day-album-info">
                                <h4>${album.title}</h4>
                                <p>${album.artist}</p>
                                ${album.isCompleted 
                                    ? `<span class="album-score ${getScoreClass(album.score)}">${album.score.toFixed(2)}</span>`
                                    : '<span class="status-badge in-progress">In Progress</span>'
                                }
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // Change year
    changeYear(delta) {
        this.currentYear += delta;
        
        // Don't go beyond current year or too far in past
        const currentYear = new Date().getFullYear();
        if (this.currentYear > currentYear) {
            this.currentYear = currentYear;
            return;
        }
        
        this.render();
    }
}

// Initialize and make available globally
let heatmap;

document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('activityHeatmap')) {
        heatmap = new ActivityHeatmap('activityHeatmap');
        heatmap.loadAndRender();
    }
});

window.heatmap = heatmap;