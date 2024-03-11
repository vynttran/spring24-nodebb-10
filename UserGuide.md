# User Guide for New Features

## LaTeX Typing Feature

**How to User Test** : 
Inline LaTeX Syntax: To render mathematical expressions or formatted text inline within your post, follow these steps: 
- Begin Inline LaTeX Syntax: Type $ to indicate the start of your inline LaTeX code. 
- Enter LaTeX Code: Between the dollar signs, input your desired LaTeX code representing the mathematical expression or formatted text. 
- End Inline LaTeX Syntax: Close the inline LaTeX code by typing another $. 

Example:
To represent the quadratic formula \( ax^2 + bx + c = 0 \) inline, you would enter: \$ax^2 + bx + c = 0\$.

**Block LaTeX Syntax** :
For more complex mathematical expressions or larger blocks of formatted text, you can utilize block LaTeX syntax. Follow these steps: 
- Begin Block LaTeX Syntax: Type $$ to indicate the start of your block LaTeX code. 
- Enter LaTeX Code: Between the dollar signs, input your desired LaTeX code representing the mathematical expression or formatted text.
- End Block LaTeX Syntax: Close the block LaTeX code by typing another $$.

Example: 
To display the equation of a circle in block format, you would write \$\$ (x - h)^2 + (y - k)^2 = r^2 \$\$. 

**Our Testing of This Feature** : 
Automated tests for the feature were added to the rest of the existing tests, which can be found in tests/posts.js. The renderLatex test suite validates posts.js function's behavior when rendering LaTeX expressions. It includes tests to ensure that the function appropriately handles invalid input by throwing errors when postData is not an object or when its content property is not a string. Additionally, it verifies that the function successfully renders both inline and block LaTeX expressions into MathML, ensuring that the rendered content is valid MathML expressions. This is done by passing in an example content with latex syntax such as $x^2$, and asserting that the rendered string is valid MathML. 

## TA Account Feature

**How to User Test** : 
When a user now registers for an account, in addition to the original options for “instructor” and “student”, there should be another account type called “TA”. Now, the user can register as an instructor, a student or a TA. When the user logged in, in the “Users” section on top, you can see all users with their account types. In the profile section, each individual user can also see their corresponding user type.
For the user test, users can register as an TA when creating the account, and see their account type in their profile and also the “User” section.

**Our Testing of This Feature** : 
Automated tests for the feature were added to the rest of the existing tests, which can be found in tests/user.js. The test of registering a TA account is being added and the test makes sure users can register a TA account and the account type can be shown correctly.

## Profanity Filter Feature

**How to User Test** : 
There is no enabling need to be done! Now posts can automatically be filtered for profanity.

To test profanity, simply create a new post that has profanity within it. In the preview window, the text will display, without any profanity whatsoever. The profanity will be entirely changed into stars. When the post is created, it will similarly appear. 
To verify that normal posts aren’t filtered, simply create a post with no profanity and verify that the string isn’t altered. 

**Our Testing of This Feature** : 

The tests can also be found tests/posts.js. These tests are sufficient because the entire feature surrounds whether an input containing words marked as profanity can be properly starred out, which is what the tests directly test for. We also have edge cases checked for, and ensured that posts are correctly modified, but also posts that are clean are left untouched.
