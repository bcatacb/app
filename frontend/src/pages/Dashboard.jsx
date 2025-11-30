import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Upload, Music, Search, Trash2, Activity, BarChart3, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [useYamnet, setUseYamnet] = useState(true);
  const [useOpenl3, setUseOpenl3] = useState(true);
  const [searchFilters, setSearchFilters] = useState({
    min_bpm: '',
    max_bpm: '',
    key: '',
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchTracks();
    fetchStats();
  }, []);

  const fetchTracks = async () => {
    try {
      const response = await axios.get(`${API}/tracks`);
      setTracks(response.data);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      toast.error('Failed to load tracks');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }

    setAnalyzing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(
        `${API}/analyze?use_yamnet=${useYamnet}&use_openl3=${useOpenl3}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      toast.success(`Analysis complete: ${response.data.filename}`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchTracks();
      fetchStats();
    } catch (error) {
      console.error('Error analyzing file:', error);
      toast.error('Failed to analyze audio file');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (trackId) => {
    try {
      await axios.delete(`${API}/track/${trackId}`);
      toast.success('Track deleted');
      fetchTracks();
      fetchStats();
    } catch (error) {
      console.error('Error deleting track:', error);
      toast.error('Failed to delete track');
    }
  };

  const handleSearch = async () => {
    try {
      const filters = {};
      if (searchFilters.min_bpm) filters.min_bpm = parseFloat(searchFilters.min_bpm);
      if (searchFilters.max_bpm) filters.max_bpm = parseFloat(searchFilters.max_bpm);
      if (searchFilters.key) filters.key = searchFilters.key;

      const response = await axios.post(`${API}/search`, filters);
      setTracks(response.data);
    } catch (error) {
      console.error('Error searching tracks:', error);
      toast.error('Search failed');
    }
  };

  const clearSearch = () => {
    setSearchFilters({ min_bpm: '', max_bpm: '', key: '' });
    fetchTracks();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
              <Music className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Beat Analyzer
              </h1>
              <p className="text-slate-400 text-sm">Intelligent audio metadata extraction</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm" data-testid="upload-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Upload className="w-5 h-5 text-violet-400" />
                  Upload Audio
                </CardTitle>
                <CardDescription className="text-slate-400">Analyze beats and instrumentals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="file-upload" className="text-slate-300">Audio File</Label>
                  <Input
                    id="file-upload"
                    type="file"
                    accept=".wav,.mp3,.flac,.m4a,.ogg"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    className="bg-slate-800/50 border-slate-700 text-slate-300 file:bg-violet-500/10 file:text-violet-400 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-lg"
                    data-testid="file-input"
                  />
                  {selectedFile && (
                    <p className="text-xs text-slate-400">Selected: {selectedFile.name}</p>
                  )}
                </div>

                <div className="space-y-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                  <p className="text-sm font-medium text-slate-300">Analysis Models</p>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="yamnet" className="text-slate-400 text-sm">YAMNet</Label>
                    <Switch
                      id="yamnet"
                      checked={useYamnet}
                      onCheckedChange={setUseYamnet}
                      data-testid="yamnet-switch"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="openl3" className="text-slate-400 text-sm">OpenL3</Label>
                    <Switch
                      id="openl3"
                      checked={useOpenl3}
                      onCheckedChange={setUseOpenl3}
                      data-testid="openl3-switch"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || analyzing}
                  className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-medium shadow-lg shadow-violet-500/20"
                  data-testid="analyze-button"
                >
                  {analyzing ? (
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 animate-pulse" />
                      Analyzing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Analyze Audio
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Stats Card */}
            {stats && (
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm mt-6" data-testid="stats-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <BarChart3 className="w-5 h-5 text-violet-400" />
                    Library Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Tracks</span>
                      <span className="text-white font-medium">{stats.total_tracks}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Avg BPM</span>
                      <span className="text-white font-medium">{stats.avg_bpm}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Total Duration</span>
                      <span className="text-white font-medium">{formatDuration(stats.total_duration)}</span>
                    </div>
                  </div>
                  {stats.common_keys.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">Common Keys</p>
                      <div className="flex flex-wrap gap-2">
                        {stats.common_keys.map((key) => (
                          <Badge key={key} variant="secondary" className="bg-violet-500/10 text-violet-300 border-violet-500/20">
                            {key}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {stats.common_moods.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-400 mb-2">Common Moods</p>
                      <div className="flex flex-wrap gap-2">
                        {stats.common_moods.map((mood) => (
                          <Badge key={mood} variant="secondary" className="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20">
                            {mood}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tracks Section */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm" data-testid="tracks-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Music className="w-5 h-5 text-violet-400" />
                    Analyzed Tracks
                  </CardTitle>
                  <Badge variant="secondary" className="bg-slate-800 text-slate-300">
                    {tracks.length} tracks
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search Filters */}
                <div className="mb-6 p-4 rounded-lg bg-slate-800/30 border border-slate-700 space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-violet-400" />
                    <p className="text-sm font-medium text-slate-300">Filter Tracks</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input
                      type="number"
                      placeholder="Min BPM"
                      value={searchFilters.min_bpm}
                      onChange={(e) => setSearchFilters({ ...searchFilters, min_bpm: e.target.value })}
                      className="bg-slate-800/50 border-slate-700 text-slate-300"
                      data-testid="min-bpm-input"
                    />
                    <Input
                      type="number"
                      placeholder="Max BPM"
                      value={searchFilters.max_bpm}
                      onChange={(e) => setSearchFilters({ ...searchFilters, max_bpm: e.target.value })}
                      className="bg-slate-800/50 border-slate-700 text-slate-300"
                      data-testid="max-bpm-input"
                    />
                    <Input
                      type="text"
                      placeholder="Key (e.g., C major)"
                      value={searchFilters.key}
                      onChange={(e) => setSearchFilters({ ...searchFilters, key: e.target.value })}
                      className="bg-slate-800/50 border-slate-700 text-slate-300"
                      data-testid="key-input"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleSearch}
                      className="bg-violet-500 hover:bg-violet-600 text-white"
                      size="sm"
                      data-testid="search-button"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Search
                    </Button>
                    <Button
                      onClick={clearSearch}
                      variant="outline"
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      size="sm"
                      data-testid="clear-search-button"
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Tracks List */}
                <ScrollArea className="h-[600px] pr-4">
                  {tracks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="empty-state">
                      <Music className="w-16 h-16 text-slate-700 mb-4" />
                      <p className="text-slate-400 text-lg">No tracks analyzed yet</p>
                      <p className="text-slate-500 text-sm">Upload an audio file to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tracks.map((track, index) => (
                        <Card key={track.id} className="bg-slate-800/30 border-slate-700 hover:bg-slate-800/50 transition-colors" data-testid={`track-${index}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="text-white font-medium mb-1">{track.filename}</h3>
                                <div className="flex items-center gap-4 text-sm text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    {track.bpm.toFixed(1)} BPM
                                  </span>
                                  <span>🎵 {track.key}</span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(track.duration)}
                                  </span>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(track.id)}
                                className="text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                data-testid={`delete-track-${index}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            {track.instruments.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-slate-500 mb-2">Instruments</p>
                                <div className="flex flex-wrap gap-2">
                                  {track.instruments.slice(0, 5).map((inst, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-xs"
                                    >
                                      {inst.name} {(inst.confidence * 100).toFixed(0)}%
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {track.mood_tags.length > 0 && (
                              <div>
                                <p className="text-xs text-slate-500 mb-2">Mood</p>
                                <div className="flex flex-wrap gap-2">
                                  {track.mood_tags.map((mood, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="secondary"
                                      className="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 text-xs"
                                    >
                                      {mood}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;