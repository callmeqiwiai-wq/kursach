
var supabaseUrl = 'https://dmjladcvinikdvpmphkw.supabase.co';
var supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtamxhZGN2aW5pa2R2cG1waGt3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzUwMjcsImV4cCI6MjA3ODYxMTAyN30.8dUxZF_YPvBoc6zL8mk8B_00c5HexRBNESeqGi2GCPY';

var supabase = supabase.createClient(supabaseUrl, supabaseKey);

var TVSchedule = function() {
    this.currentDate = new Date().toISOString().split('T')[0];
    this.init();
};

TVSchedule.prototype.init = function() {
    try {
        this.updateMoscowTime();
        setInterval(this.updateMoscowTime.bind(this), 1000);
        
        document.getElementById('datePicker').value = this.currentDate;
        this.loadChannels();
        this.loadGenres();
        this.setupEventListeners();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        this.showError('Ошибка загрузки данных: ' + error.message);
    }
};

TVSchedule.prototype.updateMoscowTime = function() {
    var now = new Date();
    var moscowTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    var timeString = moscowTime.toLocaleTimeString('ru-RU');
    var dateString = moscowTime.toLocaleDateString('ru-RU', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    document.getElementById('currentTime').textContent = dateString + ' | ' + timeString + ' (МСК)';

    if (now.getSeconds() === 0) {
        this.loadCurrentShows();
    }
};

TVSchedule.prototype.setupEventListeners = function() {
    var self = this;
    
    document.getElementById('datePicker').addEventListener('change', function(e) {
        self.currentDate = e.target.value;
        self.loadSchedule();
        self.loadCurrentShows();
    });

    document.getElementById('channelFilter').addEventListener('change', function() {
        self.loadSchedule();
        self.loadCurrentShows();
    });

    document.getElementById('genreFilter').addEventListener('change', function() {
        self.loadSchedule();
    });
};

TVSchedule.prototype.loadChannels = function() {
    var self = this;
    
    supabase
        .from('channels')
        .select('*')
        .order('name')
        .then(function(response) {
            if (response.error) {
                console.error('Error loading channels:', response.error);
                return;
            }

            var channelSelect = document.getElementById('channelFilter');
            channelSelect.innerHTML = '<option value="">Все каналы</option>';
            
            if (response.data && response.data.length > 0) {
                response.data.forEach(function(channel) {
                    var option = document.createElement('option');
                    option.value = channel.id;
                    option.textContent = channel.name;
                    channelSelect.appendChild(option);
                });
            }
        })
        .catch(function(error) {
            console.error('Error in loadChannels:', error);
        });
};

TVSchedule.prototype.loadGenres = function() {
    var self = this;
    
    supabase
        .from('genres')
        .select('*')
        .order('name')
        .then(function(response) {
            if (response.error) {
                console.error('Error loading genres:', response.error);
                return;
            }

            var genreSelect = document.getElementById('genreFilter');
            genreSelect.innerHTML = '<option value="">Все жанры</option>';
            
            if (response.data && response.data.length > 0) {
                response.data.forEach(function(genre) {
                    var option = document.createElement('option');
                    option.value = genre.id;
                    option.textContent = genre.name;
                    genreSelect.appendChild(option);
                });
            }
            
            self.loadSchedule();
            self.loadCurrentShows();
        })
        .catch(function(error) {
            console.error('Error in loadGenres:', error);
        });
};

TVSchedule.prototype.loadCurrentShows = function() {
    var self = this;
    var channelFilter = document.getElementById('channelFilter').value;
    
    var nowUTC = new Date();
    
    var query = supabase
        .from('schedule')
        .select('*, channels (*), shows (*, genres (*))')
        .lte('start_datetime', nowUTC.toISOString())
        .gte('end_datetime', nowUTC.toISOString())
        .order('channel_id', { ascending: true });

    if (channelFilter) {
        query = query.eq('channel_id', channelFilter);
    }

    query
        .then(function(response) {
            if (response.error) {
                console.error('Error loading current shows:', response.error);
                return;
            }

            // Фильтруем записи, где есть все необходимые данные
            var validShows = response.data.filter(function(show) {
                return show && show.channels && show.shows;
            });

            self.renderCurrentShows(validShows);
        })
        .catch(function(error) {
            console.error('Error in loadCurrentShows:', error);
        });
};

TVSchedule.prototype.renderCurrentShows = function(shows) {
    var container = document.getElementById('currentShowsContainer');
    var nowPlayingSection = document.getElementById('nowPlaying');
    
    if (!shows || shows.length === 0) {
        nowPlayingSection.style.display = 'none';
        return;
    }
    
    nowPlayingSection.style.display = 'block';
    
    var html = '';
    
    shows.forEach(function(show) {
        if (!show || !show.channels || !show.shows) {
            return; 
        }

        var progress = this.calculateProgress(show.start_datetime, show.end_datetime);
        
        html += '<div class="current-show">';
        html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">';
        html += '<strong>' + (show.channels.name || 'Неизвестный канал') + '</strong>';
        html += '<span class="live-badge">LIVE</span>';
        html += '</div>';
        html += '<div class="show-title">' + (show.shows.title || 'Название не указано') + '</div>';
        html += '<div class="show-meta">';
        html += (show.shows.genres ? show.shows.genres.name : 'Не указан') + ' • ' + 
                this.formatTime(show.start_datetime) + ' - ' + this.formatTime(show.end_datetime);
        html += '</div>';
        if (show.episode_title) {
            html += '<div class="show-episode">' + show.episode_title + '</div>';
        }
        html += '<div style="margin-top: 10px; background: #e9ecef; border-radius: 10px; height: 6px;">';
        html += '<div style="background: #28a745; height: 100%; border-radius: 10px; width: ' + progress + '%;"></div>';
        html += '</div>';
        html += '</div>';
    }, this);
    
    container.innerHTML = html;
};

TVSchedule.prototype.calculateProgress = function(startTime, endTime) {
    var start = new Date(startTime).getTime();
    var end = new Date(endTime).getTime();
    var now = new Date().getTime();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    var total = end - start;
    var elapsed = now - start;
    return Math.round((elapsed / total) * 100);
};

TVSchedule.prototype.loadSchedule = function() {
    var self = this;
    var loadingElement = document.getElementById('scheduleContainer');
    loadingElement.innerHTML = '<div class="loading">Загрузка расписания...</div>';

    try {
        var channelFilter = document.getElementById('channelFilter').value;
        var genreFilter = document.getElementById('genreFilter').value;
    
        var startDate = new Date(this.currentDate + 'T00:00:00Z'); // UTC
        var endDate = new Date(this.currentDate + 'T23:59:59Z'); // UTC

        var query = supabase
            .from('schedule')
            .select('*, channels (*), shows (*, genres (*))')
            .gte('start_datetime', startDate.toISOString())
            .lte('start_datetime', endDate.toISOString())
            .order('start_datetime', { ascending: true });

        if (channelFilter) {
            query = query.eq('channel_id', channelFilter);
        }

        if (genreFilter) {
            query = query.eq('shows.genre_id', genreFilter);
        }

        query
            .then(function(response) {
                if (response.error) {
                    console.error('Error loading schedule:', response.error);
                    self.showError('Ошибка загрузки расписания: ' + response.error.message);
                    return;
                }

                var validSchedule = response.data.filter(function(item) {
                    return item && item.channels && item.shows;
                });

                self.renderSchedule(validSchedule);
            })
            .catch(function(error) {
                console.error('Error in loadSchedule:', error);
                self.showError('Ошибка: ' + error.message);
            });
    } catch (error) {
        console.error('Error in loadSchedule:', error);
        self.showError('Ошибка: ' + error.message);
    }
};

TVSchedule.prototype.renderSchedule = function(schedule) {
    var container = document.getElementById('scheduleContainer');
    
    if (!schedule || schedule.length === 0) {
        container.innerHTML = '<div class="loading">На выбранную дату передач не найдено</div>';
        return;
    }

    var byChannel = schedule.reduce(function(acc, item) {

        if (!item || !item.channels) {
            return acc;
        }

        var channelId = item.channels.id;
        if (!acc[channelId]) {
            acc[channelId] = {
                channel: item.channels,
                shows: []
            };
        }
        acc[channelId].shows.push(item);
        return acc;
    }, {});

    var html = '';

    Object.values(byChannel).forEach(function(channelData) {
        html += '<div class="channel-section">';
        html += '<div class="channel-header">';
        if (channelData.channel.logo_url) {
            html += '<img src="' + channelData.channel.logo_url + '" alt="' + channelData.channel.name + '" class="channel-logo">';
        }
        html += '<div class="channel-name">' + channelData.channel.name + '</div>';
        html += '</div>';
        html += '<div class="shows-list">';
        
        channelData.shows.forEach(function(show) {
            if (!show || !show.shows) {
                return; 
            }

            var isLive = this.isShowLive(show.start_datetime, show.end_datetime);
            
            html += '<div class="show-item">';
            html += '<div class="show-time">';
            html += this.formatTime(show.start_datetime) + ' - ' + this.formatTime(show.end_datetime);
            if (isLive) {
                html += ' <span class="live-badge">LIVE</span>';
            }
            html += '</div>';
            html += '<div class="show-info">';
            html += '<div class="show-title">' + (show.shows.title || 'Название не указано') + '</div>';
            html += '<div class="show-meta">';
            html += (show.shows.genres ? show.shows.genres.name : 'Не указан') + ' • ' + 
                    (show.shows.duration_minutes || '?') + ' мин. • ' + (show.shows.age_rating || '0+');
            html += '</div>';
            if (show.episode_title) {
                html += '<div class="show-episode">' + show.episode_title;
                if (show.shows.season_number) {
                    html += ' (Сезон ' + show.shows.season_number + ', Эпизод ' + show.shows.episode_number + ')';
                }
                html += '</div>';
            }
            if (show.shows.description) {
                html += '<div class="show-description">' + show.shows.description + '</div>';
            }
            html += '</div>';
            html += '</div>';
        }, this);
        
        html += '</div>';
        html += '</div>';
    }, this);

    container.innerHTML = html;
};

TVSchedule.prototype.isShowLive = function(startTime, endTime) {
    var now = new Date();
    var start = new Date(startTime);
    var end = new Date(endTime);
    return now >= start && now <= end;
};

TVSchedule.prototype.formatTime = function(datetime) {
    var date = new Date(datetime);
    var moscowTime = new Date(date.getTime() + (3 * 60 * 60 * 1000));
    return moscowTime.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
    });
};

TVSchedule.prototype.showError = function(message) {
    var container = document.getElementById('scheduleContainer');
    container.innerHTML = '<div class="error">' +
        '<h3><i class="fas fa-exclamation-triangle"></i> Ошибка</h3>' +
        '<p>' + message + '</p>' +
        '<button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer;">Перезагрузить</button>' +
        '</div>';
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Инициализация телепрограммы...');
    new TVSchedule();

});
