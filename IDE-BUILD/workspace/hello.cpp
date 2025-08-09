#include <iostream>
#include <vector>
#include <string>

using namespace std;

// Sample C++ file
int main() {
    cout << "Hello, World!" << endl;
    cout << "Welcome to CodeCraft IDE!" << endl;
    
    // Example with vectors
    vector<int> numbers = {1, 2, 3, 4, 5};
    
    cout << "Numbers: ";
    for (int num : numbers) {
        cout << num << " ";
    }
    cout << endl;
    
    // Example with user input
    string name;
    cout << "Enter your name: ";
    getline(cin, name);
    cout << "Hello, " << name << "! Nice to meet you." << endl;
    
    return 0;
}
