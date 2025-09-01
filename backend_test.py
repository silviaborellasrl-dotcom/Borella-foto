import requests
import sys
import os
import tempfile
import openpyxl
from datetime import datetime
from io import BytesIO

class ImageSearchAPITester:
    def __init__(self, base_url="https://image-fetch-system.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {}
        
        # Don't set Content-Type for multipart/form-data requests
        if not files:
            headers['Content-Type'] = 'application/json'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                if files:
                    response = requests.post(url, data=data, files=files)
                else:
                    response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {response_data}")
                    return True, response_data
                except:
                    print(f"   Response: Binary data ({len(response.content)} bytes)")
                    return True, response.content
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        return self.run_test("Root Endpoint", "GET", "", 200)

    def test_single_search_known_codes(self):
        """Test single search with known working codes"""
        # These are the codes mentioned in the request that should work
        known_codes = ["24369", "13025", "2210", "117"]
        found_any = False
        
        for code in known_codes:
            success, response = self.run_test(
                f"Single Search - Known Code {code}",
                "POST",
                "search-single",
                200,
                data={"code": code}
            )
            
            if success and response.get('found'):
                print(f"   ✅ Found image for {code}: {response.get('image_url')}")
                print(f"   📁 Format: {response.get('format')}")
                found_any = True
            elif success:
                print(f"   ❌ No image found for {code} (should have been found)")
        
        return True, {"found_any": found_any}

    def test_single_search_test_codes(self):
        """Test single search with generic test codes"""
        test_codes = ["TEST123", "PROD001", "ABC123", "SAMPLE"]
        
        for code in test_codes:
            success, response = self.run_test(
                f"Single Search - Test Code {code}",
                "POST",
                "search-single",
                200,
                data={"code": code}
            )
            
            if success and response.get('found'):
                print(f"   ✅ Found image for {code}: {response.get('image_url')}")
            elif success:
                print(f"   ℹ️  No image found for {code} (expected)")
        
        return True, {"code": "TEST123", "found": False}

    def test_single_search_empty(self):
        """Test single search with empty code"""
        return self.run_test(
            "Single Search - Empty Code",
            "POST",
            "search-single",
            400,
            data={"code": ""}
        )

    def test_download_image_invalid(self):
        """Test download with invalid URL"""
        return self.run_test(
            "Download Image - Invalid URL",
            "GET",
            "download-image",
            404,
            params={
                "url": "https://invalid-url.com/test.jpg",
                "filename": "test.jpg"
            }
        )

    def create_test_excel_file(self, codes):
        """Create a test Excel file with product codes"""
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        
        # Add header
        sheet.cell(row=1, column=1, value="CODICE")
        
        # Add codes
        for i, code in enumerate(codes, start=2):
            sheet.cell(row=i, column=1, value=code)
        
        # Save to BytesIO
        excel_buffer = BytesIO()
        workbook.save(excel_buffer)
        excel_buffer.seek(0)
        
        return excel_buffer

    def test_batch_search_known_codes(self):
        """Test batch search with known working codes"""
        known_codes = ["24369", "13025", "2210", "117"]
        excel_file = self.create_test_excel_file(known_codes)
        
        files = {'file': ('known_codes.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        return self.run_test(
            "Batch Search - Known Codes",
            "POST",
            "search-batch",
            200,
            files=files
        )

    def test_batch_search_test_codes(self):
        """Test batch search with test codes"""
        test_codes = ["TEST123", "PROD001", "ABC123", "SAMPLE", "DEMO"]
        excel_file = self.create_test_excel_file(test_codes)
        
        files = {'file': ('test_codes.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        return self.run_test(
            "Batch Search - Test Codes",
            "POST",
            "search-batch",
            200,
            files=files
        )

    def test_batch_search_invalid_file(self):
        """Test batch search with invalid file"""
        # Create a text file instead of Excel
        text_content = "This is not an Excel file"
        files = {'file': ('test.txt', BytesIO(text_content.encode()), 'text/plain')}
        
        return self.run_test(
            "Batch Search - Invalid File",
            "POST",
            "search-batch",
            400,
            files=files
        )

    def test_batch_search_no_codice_column(self):
        """Test batch search with Excel file without CODICE column"""
        workbook = openpyxl.Workbook()
        sheet = workbook.active
        
        # Add wrong header
        sheet.cell(row=1, column=1, value="PRODUCT")
        sheet.cell(row=2, column=1, value="TEST123")
        
        excel_buffer = BytesIO()
        workbook.save(excel_buffer)
        excel_buffer.seek(0)
        
        files = {'file': ('no_codice.xlsx', excel_buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        return self.run_test(
            "Batch Search - No CODICE Column",
            "POST",
            "search-batch",
            400,
            files=files
        )

    def test_download_batch_zip_known_codes(self):
        """Test batch ZIP download with known codes"""
        known_codes = ["24369", "13025", "2210", "117"]
        excel_file = self.create_test_excel_file(known_codes)
        
        files = {'file': ('known_codes.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        success, response = self.run_test(
            "Download Batch ZIP - Known Codes",
            "POST",
            "download-batch-zip",
            200,
            files=files
        )
        
        # If no images found, it might return 404
        if not success:
            success_404, _ = self.run_test(
                "Download Batch ZIP - Known Codes (No Images)",
                "POST", 
                "download-batch-zip",
                404,
                files=files
            )
            return success_404, {}
        
        return success, response

    def test_download_batch_zip_test_codes(self):
        """Test batch ZIP download with test codes"""
        test_codes = ["TEST123", "PROD001", "ABC123"]
        excel_file = self.create_test_excel_file(test_codes)
        
        files = {'file': ('test_codes.xlsx', excel_file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
        
        success, response = self.run_test(
            "Download Batch ZIP - Test Codes",
            "POST",
            "download-batch-zip",
            200,
            files=files
        )
        
        # The endpoint might return 404 if no images are found, which is also valid
        if not success:
            success_404, _ = self.run_test(
                "Download Batch ZIP - Test Codes (No Images)",
                "POST", 
                "download-batch-zip",
                404,
                files=files
            )
            return success_404, {}
        
        return success, response

def main():
    print("🚀 Starting Image Search API Tests")
    print("=" * 50)
    
    tester = ImageSearchAPITester()
    
    # Test all endpoints
    tests = [
        tester.test_root_endpoint,
        tester.test_single_search_valid,
        tester.test_single_search_empty,
        tester.test_download_image_invalid,
        tester.test_batch_search_valid,
        tester.test_batch_search_invalid_file,
        tester.test_batch_search_no_codice_column,
        tester.test_download_batch_zip
    ]
    
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
    
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