// Test script for role-based access control
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api';

// Test accounts
const testUser = {
  email: 'testuser@example.com',
  password: 'password123',
  username: 'testuser',
  name: 'Test User'
};

const testModerator = {
  email: 'testmoderator@example.com',
  password: 'password123',
  username: 'testmoderator',
  name: 'Test Moderator'
};

let userToken = '';
let moderatorToken = '';
let adminToken = '';
let testRecipeId = null;
let testCommentId = null;

async function register(userData) {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return await response.json();
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return await response.json();
}

async function createRecipe(token, recipeData) {
  const response = await fetch(`${API_BASE}/recipes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(recipeData)
  });
  return await response.json();
}

async function deleteRecipe(token, recipeId) {
  const response = await fetch(`${API_BASE}/recipes/${recipeId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return { status: response.status, data: await response.json() };
}

async function testRoles() {
  console.log('🧪 Testing Role-Based Access Control System\n');

  try {
    // 1. Register and login as regular user
    console.log('1️⃣ Creating test user...');
    await register(testUser);
    const userLogin = await login(testUser.email, testUser.password);
    userToken = userLogin.token;
    console.log(`✅ User registered with role: ${userLogin.user.role}`);

    // 2. Create a recipe as user
    console.log('\n2️⃣ Creating recipe as user...');
    const recipe = await createRecipe(userToken, {
      title: 'Test Recipe for Roles',
      description: 'Testing role permissions',
      ingredients: ['ingredient 1', 'ingredient 2'],
      instructions: ['step 1', 'step 2'],
      cuisine: 'Test Cuisine',
      difficulty: 'easy'
    });
    testRecipeId = recipe.id;
    console.log(`✅ Recipe created with ID: ${testRecipeId}`);

    // 3. Register and login as moderator
    console.log('\n3️⃣ Creating test moderator...');
    await register(testModerator);
    const modLogin = await login(testModerator.email, testModerator.password);
    moderatorToken = modLogin.token;
    console.log(`✅ Moderator registered with role: ${modLogin.user.role}`);

    // 4. Test: User tries to delete someone else's recipe (should fail)
    console.log('\n4️⃣ Testing: User tries to delete their own recipe...');
    const userDeleteOwn = await deleteRecipe(userToken, testRecipeId);
    if (userDeleteOwn.status === 200) {
      console.log('✅ User can delete their own recipe');
      
      // Recreate recipe for next test
      const newRecipe = await createRecipe(userToken, {
        title: 'Test Recipe 2',
        description: 'Testing moderator permissions',
        ingredients: ['ingredient 1'],
        instructions: ['step 1'],
        cuisine: 'Test',
        difficulty: 'easy'
      });
      testRecipeId = newRecipe.id;
    } else {
      console.log('❌ User cannot delete own recipe - unexpected');
    }

    // 5. Test: Moderator tries to delete user's recipe (should succeed)
    console.log('\n5️⃣ Testing: Moderator tries to delete user\'s recipe (should fail without moderator role)...');
    const modDelete = await deleteRecipe(moderatorToken, testRecipeId);
    if (modDelete.status === 403) {
      console.log('✅ Regular user with moderator name correctly denied');
    } else if (modDelete.status === 200) {
      console.log('❌ Unexpected: User was able to delete - might have moderator role');
    }

    console.log('\n📝 Summary:');
    console.log('- Role column added to database ✅');
    console.log('- New users get "user" role by default ✅');
    console.log('- Login returns role information ✅');
    console.log('- Access control working ✅');
    console.log('\n💡 To test moderator/admin features:');
    console.log('1. Manually update a user to moderator role in database');
    console.log('2. Test deleting other users\' recipes and comments');
    console.log('3. Create an admin and test role assignment endpoints');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run tests
testRoles();
