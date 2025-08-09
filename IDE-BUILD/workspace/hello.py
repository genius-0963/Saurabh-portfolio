# Sample Python file
print("Hello, World!")
print("Welcome to CodeCraft IDE!")

# Example function
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

print("Factorial calculations:")
for i in range(1, 6):
    print(f"{i}! = {factorial(i)}")

# Example with user input
name = input("Enter your name: ")
print(f"Hello, {name}! Nice to meet you.")
