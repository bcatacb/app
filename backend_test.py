import requests
import sys
import json
import os
from datetime import datetime
from pathlib import Path

class BeatAnalyzerAPITester:
    def __init__(self, base_url="https://beatmetadata.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")

    def test_health_check(self):
        """Test basic API connectivity"""
        try:
            response = requests.get(f"{self.api_url}/tracks", timeout=10)
            success = response.status_code in [200, 404]  # 404 is ok if no tracks exist
            self.log_test("API Health Check", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False

    def test_get_tracks_empty(self):
        """Test getting tracks when database is empty"""
        try:
            response = requests.get(f"{self.api_url}/tracks", timeout=10)
            success = response.status_code == 200
            if success:
                tracks = response.json()
                self.log_test("Get Tracks (Empty)", True, f"Returned {len(tracks)} tracks")
            else:
                self.log_test("Get Tracks (Empty)", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Get Tracks (Empty)", False, f"Error: {str(e)}")
            return False

    def test_get_stats(self):
        """Test getting library statistics"""
        try:
            response = requests.get(f"{self.api_url}/stats", timeout=10)
            success = response.status_code == 200
            if success:
                stats = response.json()
                expected_keys = ["total_tracks", "avg_bpm", "common_keys", "common_moods", "total_duration"]
                has_all_keys = all(key in stats for key in expected_keys)
                self.log_test("Get Stats", has_all_keys, f"Stats: {stats}")
            else:
                self.log_test("Get Stats", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Get Stats", False, f"Error: {str(e)}")
            return False

    def test_search_empty(self):
        """Test search with empty filters"""
        try:
            response = requests.post(f"{self.api_url}/search", 
                                   json={}, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            success = response.status_code == 200
            if success:
                tracks = response.json()
                self.log_test("Search Empty Filters", True, f"Returned {len(tracks)} tracks")
            else:
                self.log_test("Search Empty Filters", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Search Empty Filters", False, f"Error: {str(e)}")
            return False

    def test_search_with_filters(self):
        """Test search with BPM filters"""
        try:
            filters = {
                "min_bpm": 100,
                "max_bpm": 140
            }
            response = requests.post(f"{self.api_url}/search", 
                                   json=filters, 
                                   headers={'Content-Type': 'application/json'},
                                   timeout=10)
            success = response.status_code == 200
            if success:
                tracks = response.json()
                self.log_test("Search With BPM Filters", True, f"Returned {len(tracks)} tracks")
            else:
                self.log_test("Search With BPM Filters", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Search With BPM Filters", False, f"Error: {str(e)}")
            return False

    def test_analyze_endpoint_without_file(self):
        """Test analyze endpoint without file (should fail)"""
        try:
            response = requests.post(f"{self.api_url}/analyze", timeout=10)
            # Should return 422 (validation error) since no file provided
            success = response.status_code == 422
            self.log_test("Analyze Without File", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Analyze Without File", False, f"Error: {str(e)}")
            return False

    def test_get_nonexistent_track(self):
        """Test getting a track that doesn't exist"""
        try:
            fake_id = "nonexistent-track-id"
            response = requests.get(f"{self.api_url}/track/{fake_id}", timeout=10)
            success = response.status_code == 404
            self.log_test("Get Nonexistent Track", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Get Nonexistent Track", False, f"Error: {str(e)}")
            return False

    def test_delete_nonexistent_track(self):
        """Test deleting a track that doesn't exist"""
        try:
            fake_id = "nonexistent-track-id"
            response = requests.delete(f"{self.api_url}/track/{fake_id}", timeout=10)
            success = response.status_code == 404
            self.log_test("Delete Nonexistent Track", success, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Delete Nonexistent Track", False, f"Error: {str(e)}")
            return False

    def create_test_audio_file(self):
        """Create a simple test audio file for testing"""
        try:
            import numpy as np
            import wave
            
            # Create a simple sine wave audio file
            sample_rate = 44100
            duration = 2  # seconds
            frequency = 440  # A4 note
            
            t = np.linspace(0, duration, int(sample_rate * duration), False)
            audio_data = np.sin(2 * np.pi * frequency * t)
            
            # Convert to 16-bit integers
            audio_data = (audio_data * 32767).astype(np.int16)
            
            # Save as WAV file
            test_file_path = "/tmp/test_audio.wav"
            with wave.open(test_file_path, 'w') as wav_file:
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 2 bytes per sample
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(audio_data.tobytes())
            
            return test_file_path
        except Exception as e:
            print(f"Could not create test audio file: {e}")
            return None

    def test_analyze_with_test_file(self):
        """Test analyze endpoint with a test audio file"""
        test_file = self.create_test_audio_file()
        if not test_file:
            self.log_test("Analyze With Test File", False, "Could not create test audio file")
            return False
        
        try:
            with open(test_file, 'rb') as f:
                files = {'file': ('test_audio.wav', f, 'audio/wav')}
                params = {'use_yamnet': True, 'use_openl3': True}
                
                response = requests.post(f"{self.api_url}/analyze", 
                                       files=files, 
                                       params=params,
                                       timeout=60)  # Longer timeout for analysis
                
                success = response.status_code == 200
                if success:
                    result = response.json()
                    required_fields = ['id', 'filename', 'bpm', 'key', 'instruments', 'mood_tags', 'duration']
                    has_all_fields = all(field in result for field in required_fields)
                    self.log_test("Analyze With Test File", has_all_fields, 
                                f"BPM: {result.get('bpm')}, Key: {result.get('key')}, Instruments: {len(result.get('instruments', []))}")
                    
                    # Store the track ID for further testing
                    if has_all_fields:
                        self.test_track_id = result['id']
                    return has_all_fields
                else:
                    error_msg = response.text if response.text else f"Status: {response.status_code}"
                    self.log_test("Analyze With Test File", False, error_msg)
                    return False
                    
        except Exception as e:
            self.log_test("Analyze With Test File", False, f"Error: {str(e)}")
            return False
        finally:
            # Clean up test file
            try:
                os.unlink(test_file)
            except:
                pass

    def test_get_created_track(self):
        """Test getting the track we just created"""
        if not hasattr(self, 'test_track_id'):
            self.log_test("Get Created Track", False, "No track ID available from previous test")
            return False
        
        try:
            response = requests.get(f"{self.api_url}/track/{self.test_track_id}", timeout=10)
            success = response.status_code == 200
            if success:
                track = response.json()
                self.log_test("Get Created Track", True, f"Retrieved track: {track.get('filename')}")
            else:
                self.log_test("Get Created Track", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Get Created Track", False, f"Error: {str(e)}")
            return False

    def test_delete_created_track(self):
        """Test deleting the track we created"""
        if not hasattr(self, 'test_track_id'):
            self.log_test("Delete Created Track", False, "No track ID available from previous test")
            return False
        
        try:
            response = requests.delete(f"{self.api_url}/track/{self.test_track_id}", timeout=10)
            success = response.status_code == 200
            if success:
                result = response.json()
                self.log_test("Delete Created Track", True, result.get('message', 'Track deleted'))
            else:
                self.log_test("Delete Created Track", False, f"Status: {response.status_code}")
            return success
        except Exception as e:
            self.log_test("Delete Created Track", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Beat Analyzer API Tests...")
        print(f"Testing against: {self.api_url}")
        print("=" * 50)
        
        # Basic connectivity tests
        if not self.test_health_check():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Test all endpoints
        self.test_get_tracks_empty()
        self.test_get_stats()
        self.test_search_empty()
        self.test_search_with_filters()
        self.test_analyze_endpoint_without_file()
        self.test_get_nonexistent_track()
        self.test_delete_nonexistent_track()
        
        # Test with actual file upload (if possible)
        if self.test_analyze_with_test_file():
            self.test_get_created_track()
            self.test_delete_created_track()
        
        # Print summary
        print("=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = BeatAnalyzerAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    results_file = "/app/backend_test_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
                "timestamp": datetime.now().isoformat()
            },
            "detailed_results": tester.test_results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())