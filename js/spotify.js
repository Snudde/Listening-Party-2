class SpotifyAPI {
    constructor() {
        // You'll need to replace these with your actual Spotify API credentials
        // Get them from https://developer.spotify.com/dashboard
        this.clientId = '46ad42c1aa7d48a7ba8965c390f104e3';
        this.clientSecret = 'f54078fce4264ab68761afb3b75aad90';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    // Get access token using Client Credentials flow
    async getAccessToken() {
        // Check if we have a valid token
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(this.clientId + ':' + this.clientSecret)
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                throw new Error('Failed to get Spotify access token');
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            // Set expiry to 5 minutes before actual expiry
            this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
            
            return this.accessToken;
        } catch (error) {
            console.error('Error getting Spotify token:', error);
            throw error;
        }
    }

    // Search for albums
    async searchAlbums(query) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        try {
            const token = await this.getAccessToken();
            const encodedQuery = encodeURIComponent(query);
            
            const response = await fetch(
                `https://api.spotify.com/v1/search?q=${encodedQuery}&type=album&limit=10`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Spotify search failed');
            }

            const data = await response.json();
            return this.formatSearchResults(data.albums.items);
        } catch (error) {
            console.error('Error searching Spotify:', error);
            return [];
        }
    }

    // Get full album details including tracks
    async getAlbumDetails(albumId) {
        try {
            const token = await this.getAccessToken();
            
            const response = await fetch(
                `https://api.spotify.com/v1/albums/${albumId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to get album details');
            }

            const album = await response.json();
            return this.formatAlbumDetails(album);
        } catch (error) {
            console.error('Error getting album details:', error);
            throw error;
        }
    }

    // Format search results for display
    formatSearchResults(albums) {
        return albums.map(album => ({
            id: album.id,
            title: album.name,
            artist: album.artists.map(a => a.name).join(', '),
            coverImage: album.images[0]?.url || '',
            coverImageMedium: album.images[1]?.url || album.images[0]?.url || '',
            releaseDate: album.release_date,
            totalTracks: album.total_tracks,
            spotifyUrl: album.external_urls.spotify
        }));
    }

    // Format album details with tracks
    formatAlbumDetails(album) {
        return {
            id: album.id,
            title: album.name,
            artist: album.artists.map(a => a.name).join(', '),
            coverImage: album.images[0]?.url || '',
            releaseDate: album.release_date,
            totalTracks: album.total_tracks,
            spotifyUrl: album.external_urls.spotify,
            tracks: album.tracks.items.map((track, index) => ({
                number: index + 1,
                title: track.name,
                duration: track.duration_ms,
                isInterlude: this.detectInterlude(track)
            })),
            genres: album.genres || [],
            label: album.label,
            popularity: album.popularity
        };
    }

    // Detect if a track might be an interlude
    detectInterlude(track) {
        const title = track.name.toLowerCase();
        const keywords = ['interlude', 'intro', 'outro', 'skit', 'prelude'];
        const isShort = track.duration_ms < 90000; // Less than 1.5 minutes
        
        const hasKeyword = keywords.some(keyword => title.includes(keyword));
        
        // Mark as interlude if it has keyword or is very short
        return hasKeyword || (isShort && track.duration_ms < 60000);
    }

    // Download album cover image and return as blob for upload
    async downloadCoverImage(imageUrl) {
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error('Failed to download cover image');
            }
            
            const blob = await response.blob();
            // Convert blob to file
            const fileName = `spotify_cover_${Date.now()}.jpg`;
            return new File([blob], fileName, { type: 'image/jpeg' });
        } catch (error) {
            console.error('Error downloading cover image:', error);
            throw error;
        }
    }
}

// Create global instance
window.spotifyAPI = new SpotifyAPI();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SpotifyAPI;
}