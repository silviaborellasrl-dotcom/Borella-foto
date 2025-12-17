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

    def create_test_excel(self):
        """Create a test Excel file with sample mappings"""
        wb = Workbook()
        ws = wb.active
        
        # Add headers
        ws['A1'] = 'CODICE'
        ws['B1'] = 'COD PRODOTTO'
        
        # Add test data
        test_data = [
            ('IMG001', 'PROD_A_001'),
            ('IMG002', 'PROD_B_002'),
            ('IMG003', 'PROD_C_003'),
            ('photo1', 'NEW_PHOTO_1'),
            ('photo2', 'NEW_PHOTO_2')
        ]
        
        for i, (codice, cod_prodotto) in enumerate(test_data, start=2):
            ws[f'A{i}'] = codice
            ws[f'B{i}'] = cod_prodotto
        
        # Save to bytes
        excel_buffer = io.BytesIO()
        wb.save(excel_buffer)
        excel_buffer.seek(0)
        
        return excel_buffer.getvalue()

    def create_test_image(self, filename):
        """Create a simple test image file"""
        # Create a minimal PNG file (1x1 pixel)
        png_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
        return png_data

    def test_root_endpoint(self):
        """Test GET /api/ endpoint"""
        success, response = self.run_test(
            "Root API endpoint",
            "GET",
            "",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Message: {response.get('message', 'No message')}")
        return success

    def test_get_empty_mappings(self):
        """Test GET /api/excel-mapping with no data"""
        success, response = self.run_test(
            "Get empty Excel mappings",
            "GET",
            "excel-mapping",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Total mappings: {response.get('total', 0)}")
        return success

    def test_upload_excel(self):
        """Test POST /api/upload-excel"""
        excel_data = self.create_test_excel()
        
        files = {
            'file': ('test_mappings.xlsx', excel_data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        }
        
        success, response = self.run_test(
            "Upload Excel file",
            "POST",
            "upload-excel",
            200,
            files=files
        )
        
        if success and isinstance(response, dict):
            print(f"   Mappings loaded: {response.get('total', 0)}")
            if response.get('mappings'):
                print(f"   First mapping: {response['mappings'][0]['codice']} -> {response['mappings'][0]['cod_prodotto']}")
        
        return success

    def test_get_loaded_mappings(self):
        """Test GET /api/excel-mapping after loading data"""
        success, response = self.run_test(
            "Get loaded Excel mappings",
            "GET",
            "excel-mapping",
            200
        )
        if success and isinstance(response, dict):
            print(f"   Total mappings: {response.get('total', 0)}")
        return success

    def test_process_images(self):
        """Test POST /api/process-images"""
        # Create test images that match our Excel mappings
        test_files = [
            ('IMG001.jpg', self.create_test_image('IMG001.jpg')),
            ('IMG002.png', self.create_test_image('IMG002.png')),
            ('unknown.jpg', self.create_test_image('unknown.jpg'))  # This should fail
        ]
        
        files = []
        for filename, data in test_files:
            files.append(('files', (filename, data, 'image/jpeg' if filename.endswith('.jpg') else 'image/png')))
        
        success, response = self.run_test(
            "Process images",
            "POST",
            "process-images",
            200,
            files=files
        )
        
        if success and isinstance(response, dict):
            print(f"   Success count: {response.get('success_count', 0)}")
            print(f"   Error count: {response.get('error_count', 0)}")
            print(f"   ZIP ready: {response.get('zip_ready', False)}")
            
            if response.get('session_id'):
                self.session_id = response['session_id']
                print(f"   Session ID: {self.session_id}")
        
        return success

    def test_download_zip(self):
        """Test GET /api/download-zip/{session_id}"""
        if not self.session_id:
            print("❌ No session ID available for ZIP download test")
            return False
        
        success, response = self.run_test(
            "Download ZIP file",
            "GET",
            f"download-zip/{self.session_id}",
            200
        )
        
        if success:
            if isinstance(response, bytes):
                print(f"   ZIP file size: {len(response)} bytes")
            else:
                print(f"   Response type: {type(response)}")
        
        return success

    def test_invalid_excel_upload(self):
        """Test uploading invalid file as Excel"""
        files = {
            'file': ('test.txt', b'This is not an Excel file', 'text/plain')
        }
        
        success, response = self.run_test(
            "Upload invalid Excel file",
            "POST",
            "upload-excel",
            400,
            files=files
        )
        return success

    def test_process_images_without_excel(self):
        """Test processing images without Excel mappings loaded"""
        # First clear mappings
        self.run_test("Clear mappings", "DELETE", "clear-mappings", 200)
        
        # Try to process images
        files = [('files', ('test.jpg', self.create_test_image('test.jpg'), 'image/jpeg'))]
        
        success, response = self.run_test(
            "Process images without Excel",
            "POST",
            "process-images",
            400,
            files=files
        )
        return success

def main():
    print("🚀 Starting Photo Renamer API Tests")
    print("=" * 50)
    
    tester = PhotoRenamerAPITester()
    
    # Test sequence
    tests = [
        ("Root endpoint", tester.test_root_endpoint),
        ("Empty mappings", tester.test_get_empty_mappings),
        ("Upload Excel", tester.test_upload_excel),
        ("Get loaded mappings", tester.test_get_loaded_mappings),
        ("Process images", tester.test_process_images),
        ("Download ZIP", tester.test_download_zip),
        ("Invalid Excel upload", tester.test_invalid_excel_upload),
        ("Process without Excel", tester.test_process_images_without_excel),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test '{test_name}' crashed: {str(e)}")
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())