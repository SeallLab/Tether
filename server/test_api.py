#!/usr/bin/env python3
"""
Test script for the RAG Flask API
Tests all endpoints to ensure they work correctly
"""

import requests
import json
import time
import sys
from typing import Dict, Any


class RAGAPITester:
    """Test class for the RAG API"""
    
    def __init__(self, base_url: str = "http://localhost:5000"):
        self.base_url = base_url
        self.session_id = None
    
    def test_health_check(self) -> bool:
        """Test the health check endpoint"""
        print("🔍 Testing health check endpoint...")
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    print("✅ Health check passed")
                    return True
                else:
                    print(f"❌ Health check failed: {data}")
                    return False
            else:
                print(f"❌ Health check failed with status {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Health check failed with error: {e}")
            return False
    
    def test_create_session(self) -> bool:
        """Test creating a session"""
        print("🔍 Testing session creation...")
        
        try:
            response = requests.post(f"{self.base_url}/session", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("session_id"):
                    self.session_id = data["session_id"]
                    print(f"✅ Session created: {self.session_id}")
                    return True
                else:
                    print(f"❌ Session creation failed: {data}")
                    return False
            else:
                print(f"❌ Session creation failed with status {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Session creation failed with error: {e}")
            return False
    
    def test_generate_response(self) -> bool:
        """Test generating a response"""
        if not self.session_id:
            print("❌ No session ID available for testing")
            return False
        
        print("🔍 Testing response generation...")
        
        test_message = "Hello! Can you help me understand what emotion regulation is?"
        
        payload = {
            "message": test_message,
            "session_id": self.session_id
        }
        
        try:
            response = requests.post(
                f"{self.base_url}/generate",
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload),
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and data.get("response"):
                    print(f"✅ Response generated successfully")
                    print(f"📝 Response preview: {data['response'][:100]}...")
                    return True
                else:
                    print(f"❌ Response generation failed: {data}")
                    return False
            else:
                print(f"❌ Response generation failed with status {response.status_code}")
                print(f"Response: {response.text}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Response generation failed with error: {e}")
            return False
    
    def test_conversation_history(self) -> bool:
        """Test getting conversation history"""
        if not self.session_id:
            print("❌ No session ID available for testing")
            return False
        
        print("🔍 Testing conversation history retrieval...")
        
        try:
            response = requests.get(
                f"{self.base_url}/conversation/{self.session_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success") and "history" in data:
                    history = data["history"]
                    print(f"✅ Conversation history retrieved ({len(history)} messages)")
                    return True
                else:
                    print(f"❌ Conversation history retrieval failed: {data}")
                    return False
            else:
                print(f"❌ Conversation history retrieval failed with status {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Conversation history retrieval failed with error: {e}")
            return False
    
    def test_multiple_exchanges(self) -> bool:
        """Test multiple conversation exchanges"""
        if not self.session_id:
            print("❌ No session ID available for testing")
            return False
        
        print("🔍 Testing multiple conversation exchanges...")
        
        messages = [
            "What strategies help with emotion regulation?",
            "Can you give me more specific examples?",
            "How does this relate to ADHD?"
        ]
        
        for i, message in enumerate(messages, 1):
            print(f"  📨 Sending message {i}/{len(messages)}: {message[:50]}...")
            
            payload = {
                "message": message,
                "session_id": self.session_id
            }
            
            try:
                response = requests.post(
                    f"{self.base_url}/generate",
                    headers={"Content-Type": "application/json"},
                    data=json.dumps(payload),
                    timeout=30
                )
                
                if response.status_code != 200:
                    print(f"❌ Message {i} failed with status {response.status_code}")
                    return False
                
                data = response.json()
                if not data.get("success"):
                    print(f"❌ Message {i} failed: {data}")
                    return False
                
                print(f"  ✅ Message {i} successful")
                time.sleep(1)  # Brief pause between messages
                
            except requests.exceptions.RequestException as e:
                print(f"❌ Message {i} failed with error: {e}")
                return False
        
        print("✅ Multiple exchanges completed successfully")
        return True
    
    def test_clear_session(self) -> bool:
        """Test clearing a session"""
        if not self.session_id:
            print("❌ No session ID available for testing")
            return False
        
        print("🔍 Testing session clearing...")
        
        try:
            response = requests.delete(
                f"{self.base_url}/conversation/{self.session_id}",
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("success"):
                    print("✅ Session cleared successfully")
                    return True
                else:
                    print(f"❌ Session clearing failed: {data}")
                    return False
            else:
                print(f"❌ Session clearing failed with status {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Session clearing failed with error: {e}")
            return False
    
    def run_all_tests(self) -> bool:
        """Run all tests"""
        print("🚀 Starting RAG API Tests...")
        print(f"🎯 Target URL: {self.base_url}")
        print("=" * 50)
        
        tests = [
            ("Health Check", self.test_health_check),
            ("Session Creation", self.test_create_session),
            ("Response Generation", self.test_generate_response),
            ("Conversation History", self.test_conversation_history),
            ("Multiple Exchanges", self.test_multiple_exchanges),
            ("Session Clearing", self.test_clear_session),
        ]
        
        passed = 0
        total = len(tests)
        
        for test_name, test_func in tests:
            print(f"\n📋 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    print(f"❌ {test_name} failed")
            except Exception as e:
                print(f"❌ {test_name} failed with exception: {e}")
        
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
            return True
        else:
            print("❌ Some tests failed")
            return False


def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test the RAG API")
    parser.add_argument("--url", default="http://localhost:5000", help="Base URL for the API")
    parser.add_argument("--quick", action="store_true", help="Run only basic tests")
    
    args = parser.parse_args()
    
    tester = RAGAPITester(base_url=args.url)
    
    if args.quick:
        # Run only basic tests
        success = (
            tester.test_health_check() and
            tester.test_create_session() and
            tester.test_generate_response()
        )
    else:
        # Run all tests
        success = tester.run_all_tests()
    
    if success:
        print("\n✅ All tests completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    main() 