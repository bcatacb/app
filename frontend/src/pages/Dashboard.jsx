import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Upload, Music, Search, Trash2, Activity, BarChart3, Clock, Grid3x3, List, Table, Filter, SlidersHorizontal, TrendingUp, Disc3, X } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const [tracks, setTracks] = useState([]);
  const [filteredTracks, setFilteredTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [useYamnet, setUseYamnet] = useState(true);
  const [useOpenl3, setUseOpenl3] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(true);
  const [searchFilters, setSearchFilters] = useState({
    min_bpm: '',
    max_bpm: '',
    key: '',
    mood: '',
    instrument: '',
    filename: '',
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchTracks();
    fetchStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tracks, searchFilters]);

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
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setSelectedFiles(files);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    setAnalyzing(true);

    try {
      if (selectedFiles.length === 1) {
        const formData = new FormData();
        formData.append('file', selectedFiles[0]);

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
      } else {
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });

        const response = await axios.post(
          `${API}/analyze-batch?use_yamnet=${useYamnet}&use_openl3=${useOpenl3}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        const { successful, failed, errors } = response.data;
        
        if (successful > 0) {
          toast.success(`Successfully analyzed ${successful} file${successful > 1 ? 's' : ''}`);
        }
        
        if (failed > 0) {
          errors.forEach(err => {
            toast.error(`Failed: ${err.filename}`);
          });
        }
      }

      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchTracks();
      fetchStats();
    } catch (error) {
      console.error('Error analyzing files:', error);
      toast.error('Failed to analyze audio files');
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

  const applyFilters = () => {
    let filtered = [...tracks];

    if (searchFilters.filename) {
      filtered = filtered.filter(track => 
        track.filename.toLowerCase().includes(searchFilters.filename.toLowerCase())
      );
    }

    if (searchFilters.min_bpm) {
      filtered = filtered.filter(track => track.bpm >= parseFloat(searchFilters.min_bpm));
    }
    if (searchFilters.max_bpm) {
      filtered = filtered.filter(track => track.bpm <= parseFloat(searchFilters.max_bpm));
    }

    if (searchFilters.key) {
      filtered = filtered.filter(track => 
        track.key.toLowerCase().includes(searchFilters.key.toLowerCase())
      );
    }

    if (searchFilters.mood) {
      filtered = filtered.filter(track => 
        track.mood_tags.some(mood => mood.toLowerCase().includes(searchFilters.mood.toLowerCase()))
      );
    }

    if (searchFilters.instrument) {
      filtered = filtered.filter(track => 
        track.instruments.some(inst => inst.name.toLowerCase().includes(searchFilters.instrument.toLowerCase()))
      );
    }

    setFilteredTracks(filtered);
  };

  const clearSearch = () => {
    setSearchFilters({ 
      min_bpm: '', 
      max_bpm: '', 
      key: '',
      mood: '',
      instrument: '',
      filename: ''
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasActiveFilters = Object.values(searchFilters).some(v => v !== '');

  // Grid View Component
  const GridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredTracks.map((track, index) => (
        <Card 
          key={track.id} 
          className="bg-slate-800/40 border-slate-700 hover:bg-slate-800/60 hover:border-violet-500/30 transition-all group"
          data-testid={`track-grid-${index}`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/30">
                  <Disc3 className="w-6 h-6 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm truncate">{track.filename}</h3>
                  <p className="text-xs text-slate-500">{formatDuration(track.duration)}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(track.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                data-testid={`delete-track-${index}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-violet-400">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="font-medium">{track.bpm.toFixed(0)}</span>
                  <span className="text-slate-500 text-xs">BPM</span>
                </div>
                <div className="flex items-center gap-1.5 text-fuchsia-400">
                  <Music className="w-3.5 h-3.5" />
                  <span className="font-medium">{track.key}</span>
                </div>
              </div>

              {track.mood_tags.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Mood</p>
                  <div className="flex flex-wrap gap-1.5">
                    {track.mood_tags.slice(0, 3).map((mood, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 text-xs px-2 py-0"
                      >
                        {mood}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {track.instruments.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1.5">Instruments</p>
                  <div className="flex flex-wrap gap-1.5">
                    {track.instruments.slice(0, 2).map((inst, idx) => (
                      <Badge
                        key={idx}
                        variant="secondary"
                        className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-xs px-2 py-0"
                      >
                        {inst.name.split(' ')[0]} {(inst.confidence * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // List View Component
  const ListView = () => (
    <div className="space-y-3">
      {filteredTracks.map((track, index) => (
        <Card 
          key={track.id} 
          className="bg-slate-800/40 border-slate-700 hover:bg-slate-800/60 transition-colors"
          data-testid={`track-list-${index}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/30 flex-shrink-0">
                <Disc3 className="w-7 h-7 text-violet-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-medium">{track.filename}</h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {track.bpm.toFixed(1)} BPM
                      </span>
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        {track.key}
                      </span>
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

                <div className="flex gap-4">
                  {track.mood_tags.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Mood:</span>
                      <div className="flex gap-1.5">
                        {track.mood_tags.slice(0, 4).map((mood, idx) => (
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

                  {track.instruments.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Instruments:</span>
                      <div className="flex gap-1.5">
                        {track.instruments.slice(0, 3).map((inst, idx) => (
                          <Badge
                            key={idx}
                            variant="secondary"
                            className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-xs"
                          >
                            {inst.name.split(' ')[0]}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  // Table View Component
  const TableView = () => (
    <div className="rounded-lg border border-slate-700 overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-800/60 border-b border-slate-700">
          <tr>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">File</th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">BPM</th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Key</th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Duration</th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Mood</th>
            <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Instruments</th>
            <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody className="bg-slate-800/20 divide-y divide-slate-700">
          {filteredTracks.map((track, index) => (
            <tr key={track.id} className="hover:bg-slate-800/40 transition-colors" data-testid={`track-table-${index}`}>
              <td className="px-4 py-3 text-sm text-white font-medium">{track.filename}</td>
              <td className="px-4 py-3 text-sm text-slate-300">{track.bpm.toFixed(1)}</td>
              <td className="px-4 py-3 text-sm text-slate-300">{track.key}</td>
              <td className="px-4 py-3 text-sm text-slate-300">{formatDuration(track.duration)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {track.mood_tags.slice(0, 2).map((mood, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 text-xs"
                    >
                      {mood}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  {track.instruments.slice(0, 2).map((inst, idx) => (
                    <Badge
                      key={idx}
                      variant="secondary"
                      className="bg-violet-500/10 text-violet-300 border-violet-500/20 text-xs"
                    >
                      {inst.name.split(' ')[0]}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(track.id)}
                  className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8"
                  data-testid={`delete-track-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/20">
                <Music className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Beat Analyzer
                </h1>
                <p className="text-slate-400 text-sm">Audio Library Explorer</p>
              </div>
            </div>

            {stats && (
              <div className="hidden lg:flex items-center gap-6">
                <div className="text-right">
                  <p className="text-2xl font-bold text-white">{stats.total_tracks}</p>
                  <p className="text-xs text-slate-400">Total Tracks</p>
                </div>
                <Separator orientation="vertical" className="h-10 bg-slate-700" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-violet-400">{stats.avg_bpm || 0}</p>
                  <p className="text-xs text-slate-400">Avg BPM</p>
                </div>
                <Separator orientation="vertical" className="h-10 bg-slate-700" />
                <div className="text-right">
                  <p className="text-2xl font-bold text-fuchsia-400">{formatDuration(stats.total_duration)}</p>
                  <p className="text-xs text-slate-400">Total Time</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <Tabs defaultValue="explorer" className="space-y-6">
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="explorer" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Search className="w-4 h-4 mr-2" />
              Explorer
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-300">
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistics
            </TabsTrigger>
          </TabsList>

          {/* Explorer Tab */}
          <TabsContent value="explorer" className="space-y-6">
            {/* Filters & View Controls */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Button
                      variant={showFilters ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                      className={showFilters ? "bg-violet-500 hover:bg-violet-600" : "border-slate-700 text-slate-300"}
                      data-testid="toggle-filters-button"
                    >
                      <SlidersHorizontal className="w-4 h-4 mr-2" />
                      Filters {hasActiveFilters && `(${Object.values(searchFilters).filter(v => v).length})`}
                    </Button>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSearch}
                        className="text-slate-400 hover:text-slate-300"
                        data-testid="clear-filters-button"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Clear
                      </Button>
                    )}
                    <Separator orientation="vertical" className="h-6 bg-slate-700" />
                    <span className="text-sm text-slate-400">
                      {filteredTracks.length} of {tracks.length} tracks
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('grid')}
                      className={viewMode === 'grid' ? 'bg-violet-500' : 'text-slate-400'}
                      data-testid="grid-view-button"
                    >
                      <Grid3x3 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('list')}
                      className={viewMode === 'list' ? 'bg-violet-500' : 'text-slate-400'}
                      data-testid="list-view-button"
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="icon"
                      onClick={() => setViewMode('table')}
                      className={viewMode === 'table' ? 'bg-violet-500' : 'text-slate-400'}
                      data-testid="table-view-button"
                    >
                      <Table className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {showFilters && (
                  <div className="space-y-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Filename</Label>
                        <Input
                          placeholder="Search by name..."
                          value={searchFilters.filename}
                          onChange={(e) => setSearchFilters({ ...searchFilters, filename: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="filename-filter-input"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Min BPM</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 80"
                          value={searchFilters.min_bpm}
                          onChange={(e) => setSearchFilters({ ...searchFilters, min_bpm: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="min-bpm-filter-input"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Max BPM</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 140"
                          value={searchFilters.max_bpm}
                          onChange={(e) => setSearchFilters({ ...searchFilters, max_bpm: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="max-bpm-filter-input"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Key</Label>
                        <Input
                          placeholder="e.g., C major"
                          value={searchFilters.key}
                          onChange={(e) => setSearchFilters({ ...searchFilters, key: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="key-filter-input"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Mood</Label>
                        <Input
                          placeholder="e.g., energetic"
                          value={searchFilters.mood}
                          onChange={(e) => setSearchFilters({ ...searchFilters, mood: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="mood-filter-input"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-400 text-xs mb-2">Instrument</Label>
                        <Input
                          placeholder="e.g., piano"
                          value={searchFilters.instrument}
                          onChange={(e) => setSearchFilters({ ...searchFilters, instrument: e.target.value })}
                          className="bg-slate-800/50 border-slate-700 text-slate-300"
                          data-testid="instrument-filter-input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tracks Display */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              {filteredTracks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-explorer-state">
                  <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                    <Music className="w-10 h-10 text-slate-600" />
                  </div>
                  <p className="text-slate-400 text-lg mb-2">
                    {tracks.length === 0 ? 'No tracks in library' : 'No tracks match your filters'}
                  </p>
                  <p className="text-slate-500 text-sm">
                    {tracks.length === 0 ? 'Upload audio files to get started' : 'Try adjusting your search criteria'}
                  </p>
                </div>
              ) : (
                <div>
                  {viewMode === 'grid' && <GridView />}
                  {viewMode === 'list' && <ListView />}
                  {viewMode === 'table' && <TableView />}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Upload Tab */}
          <TabsContent value="upload">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Upload className="w-5 h-5 text-violet-400" />
                    Upload Audio Files
                  </CardTitle>
                  <CardDescription className="text-slate-400">Analyze beats and instrumentals with AI</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload" className="text-slate-300">Audio Files (multiple supported)</Label>
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".wav,.mp3,.flac,.m4a,.ogg"
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      multiple
                      className="bg-slate-800/50 border-slate-700 text-slate-300 file:bg-violet-500/10 file:text-violet-400 file:border-0 file:mr-4 file:py-2 file:px-4 file:rounded-lg"
                      data-testid="file-input"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="text-xs text-slate-400 space-y-1 mt-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700">
                        <p className="font-medium text-violet-400 mb-2">{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected:</p>
                        <ScrollArea className="max-h-32">
                          <div className="space-y-1">
                            {selectedFiles.map((file, idx) => (
                              <p key={idx} className="text-slate-400">• {file.name}</p>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <p className="text-sm font-medium text-slate-300">Analysis Models</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="yamnet" className="text-slate-300 text-sm">YAMNet</Label>
                        <p className="text-xs text-slate-500">Google's audio classifier</p>
                      </div>
                      <Switch
                        id="yamnet"
                        checked={useYamnet}
                        onCheckedChange={setUseYamnet}
                        data-testid="yamnet-switch"
                      />
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="openl3" className="text-slate-300 text-sm">OpenL3</Label>
                        <p className="text-xs text-slate-500">Deep audio embeddings</p>
                      </div>
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
                    disabled={selectedFiles.length === 0 || analyzing}
                    className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white font-medium shadow-lg shadow-violet-500/20"
                    data-testid="analyze-button"
                  >
                    {analyzing ? (
                      <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 animate-pulse" />
                        Analyzing {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Analyze {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Audio
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <TrendingUp className="w-5 h-5 text-violet-400" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    {tracks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="w-12 h-12 text-slate-700 mb-3" />
                        <p className="text-slate-400">No recent activity</p>
                        <p className="text-slate-500 text-sm">Upload files to see them here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tracks.slice(0, 10).map((track, idx) => (
                          <div key={track.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center border border-violet-500/30 flex-shrink-0">
                              <Music className="w-5 h-5 text-violet-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white font-medium truncate">{track.filename}</p>
                              <p className="text-xs text-slate-500">{track.bpm.toFixed(0)} BPM • {track.key}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Library Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Tracks</span>
                      <span className="text-2xl font-bold text-white">{stats.total_tracks}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Average BPM</span>
                      <span className="text-2xl font-bold text-violet-400">{stats.avg_bpm}</span>
                    </div>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Duration</span>
                      <span className="text-2xl font-bold text-fuchsia-400">{formatDuration(stats.total_duration)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Common Keys</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.common_keys.length > 0 ? (
                      <div className="space-y-3">
                        {stats.common_keys.map((key, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700">
                            <span className="text-white font-medium">{key}</span>
                            <Badge variant="secondary" className="bg-violet-500/20 text-violet-300 border-violet-500/30">
                              Popular
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-8">No data yet</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-white text-lg">Common Moods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.common_moods.length > 0 ? (
                      <div className="space-y-3">
                        {stats.common_moods.map((mood, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700">
                            <span className="text-white font-medium capitalize">{mood}</span>
                            <Badge variant="secondary" className="bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30">
                              Popular
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-center py-8">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
