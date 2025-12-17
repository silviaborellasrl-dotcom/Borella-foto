import requests
import sys
import json
import io
from datetime import datetime
from PIL import Image

class PhotoRenamerAPITester:
    def __init__(self, base_url="https://excel-to-filename.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else f"{self.api_url}/"
        headers = {}
        if data and not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, timeout=60)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return success, response_data
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Error: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        if success:
            print(f"   Response: {response}")
        return success

    def test_excel_mappings(self):
        """Test Excel mappings endpoint"""
        success, response = self.run_test(
            "Excel Mappings",
            "GET",
            "excel-mapping",
            200
        )
        if success:
            mappings_count = response.get('total', 0)
            print(f"   Mappings loaded: {mappings_count}")
            if mappings_count == 911:
                print("✅ Expected 911 mappings found!")
            elif mappings_count > 0:
                print(f"⚠️  Found {mappings_count} mappings (expected 911)")
            else:
                print("❌ No mappings found")
                return False
            
            # Show first few mappings
            mappings = response.get('mappings', [])
            if mappings:
                print("   Sample mappings:")
                for i, mapping in enumerate(mappings[:3]):
                    print(f"     {mapping.get('codice')} -> {mapping.get('cod_prodotto')}")
                    
        return success, response.get('mappings', []) if success else []

    def create_test_image(self, filename, size=(100, 100)):
        """Create a test image file"""
        img = Image.new('RGB', size, color='red')
        img_bytes = io.BytesIO()
        format_map = {
            '.jpg': 'JPEG',
            '.jpeg': 'JPEG', 
            '.png': 'PNG',
            '.webp': 'WEBP'
        }
        ext = '.' + filename.split('.')[-1].lower()
        img_format = format_map.get(ext, 'JPEG')
        img.save(img_bytes, format=img_format)
        img_bytes.seek(0)
        return img_bytes

    def test_process_images(self, mappings):
        """Test image processing with sample files"""
        if not mappings:
            print("❌ No mappings available for testing image processing")
            return False
            
        # Use first few mappings to create test files
        test_files = []
        sample_mappings = mappings[:3]  # Test with first 3 mappings
        
        print(f"   Creating test files from mappings:")
        for mapping in sample_mappings:
            codice = mapping.get('codice')
            cod_prodotto = mapping.get('cod_prodotto')
            print(f"     {codice} -> {cod_prodotto}")
            
            # Create test image with the codice as filename
            filename = f"{codice}.jpg"
            img_bytes = self.create_test_image(filename)
            test_files.append(('files', (filename, img_bytes, 'image/jpeg')))

        success, response = self.run_test(
            "Process Images",
            "POST",
            "process-images",
            200,
            files=test_files
        )
        
        if success:
            success_count = response.get('success_count', 0)
            error_count = response.get('error_count', 0)
            self.session_id = response.get('session_id')
            
            print(f"   Success count: {success_count}")
            print(f"   Error count: {error_count}")
            print(f"   Session ID: {self.session_id}")
            
            # Show results
            results = response.get('results', [])
            for result in results:
                status = "✅" if result.get('status') == 'success' else "❌"
                print(f"   {status} {result.get('original_name')} -> {result.get('new_name')}")
                
        return success

    def test_download_zip(self):
        """Test ZIP download"""
        if not self.session_id:
            print("❌ No session ID available for ZIP download test")
            return False
            
        success, _ = self.run_test(
            "Download ZIP",
            "GET",
            f"download-zip/{self.session_id}",
            200
        )
        
        if success:
            print("   ZIP download successful")
            
        return success

def main():
    print("🚀 Starting Photo Renamer API Tests")
    print("=" * 50)
    
    # Setup
    tester = PhotoRenamerAPITester()
    
    # Test 1: Root endpoint
    if not tester.test_root_endpoint():
        print("❌ Root endpoint failed, stopping tests")
        return 1

    # Test 2: Excel mappings
    mappings_success, mappings = tester.test_excel_mappings()
    if not mappings_success:
        print("❌ Excel mappings failed, stopping tests")
        return 1

    # Test 3: Process images
    if not tester.test_process_images(mappings):
        print("❌ Image processing failed")
        return 1

    # Test 4: Download ZIP
    if not tester.test_download_zip():
        print("❌ ZIP download failed")
        return 1

    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())