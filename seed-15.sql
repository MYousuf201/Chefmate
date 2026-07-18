-- Create demo user (if not exists)
INSERT IGNORE INTO users (email, password, username, name, role)
VALUES ('chefmate@demo.com', '$2a$12$jSd0OvBPmnoJY2O1iC1PK.N2Q6F3f.dEaTSHrB93Wp6vU1SQVCvCi', 'chefmate', 'Chef-Mate Demo', 'user');

-- Grab the user ID
SET @uid = (SELECT id FROM users WHERE email = 'chefmate@demo.com');

-- Italian: Classic Spaghetti Carbonara
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Classic Spaghetti Carbonara',
'A rich Roman pasta dish with eggs, pecorino, guanciale, and black pepper.',
'["400g spaghetti","200g guanciale or pancetta","4 large eggs","100g Pecorino Romano","100g Parmigiano-Reggiano","Fresh black pepper","Salt"]',
'["Cook spaghetti in salted boiling water until al dente.","Dice guanciale and render in a cold pan over medium heat until crispy.","Whisk eggs with grated cheeses and generous black pepper.","Drain pasta, reserving 1 cup pasta water.","Toss hot pasta with guanciale and its fat, then remove from heat.","Pour egg mixture over pasta, tossing vigorously. Add pasta water gradually.","Serve immediately with extra cheese and pepper."]',
'italian', 'medium', 10, 15, 4, 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=800', @uid);

-- Italian: Margherita Pizza
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Margherita Pizza',
'Authentic Neapolitan pizza with chewy crust, San Marzano tomato sauce, fresh mozzarella, and basil.',
'["500g bread flour","325ml warm water","7g active dry yeast","10g salt","400g San Marzano tomatoes","250g fresh mozzarella","Fresh basil","Extra virgin olive oil"]',
'["Dissolve yeast in warm water and let sit 5 minutes.","Mix flour and salt, add yeast mixture, knead 10 minutes until smooth.","Let dough rise in oiled bowl for 2 hours until doubled.","Divide dough into 4 balls and rest 30 minutes.","Stretch each into a 12-inch round.","Top with crushed tomatoes, mozzarella, and olive oil.","Bake at 500F on preheated stone for 8-10 minutes.","Top with fresh basil and serve immediately."]',
'italian', 'hard', 150, 10, 4, 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800', @uid);

-- Italian: Creamy Mushroom Risotto
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Creamy Mushroom Risotto',
'Velvety Arborio rice with wild mushrooms, finished with parmesan and fresh thyme.',
'["1 1/2 cups Arborio rice","300g mixed mushrooms","1 onion finely diced","3 cloves garlic","1/2 cup dry white wine","4 cups warm vegetable broth","1/2 cup grated Parmesan","2 tbsp butter","Fresh thyme","Salt and pepper"]',
'["Saute sliced mushrooms in butter until golden. Set aside.","Cook onion and garlic until translucent.","Add rice and toast 2 minutes, stirring.","Pour in wine and stir until absorbed.","Add warm broth one ladle at a time, stirring continuously for 18 minutes.","Fold in mushrooms, Parmesan, and butter.","Season with salt, pepper, and fresh thyme."]',
'italian', 'medium', 15, 30, 4, 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=800', @uid);

-- Italian: Tomato Basil Soup
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Tomato Basil Soup',
'A comforting classic: roasted tomato soup with fresh basil, finished with a swirl of cream.',
'["1kg Roma tomatoes halved","1 onion quartered","4 cloves garlic","2 cups vegetable broth","1/4 cup fresh basil","1/2 cup heavy cream","2 tbsp olive oil","Salt and pepper","Croutons for serving"]',
'["Toss tomatoes, onion, and garlic with olive oil. Roast at 400F for 30 minutes.","Transfer roasted vegetables to a pot. Add broth and bring to a boil.","Simmer 10 minutes. Add basil.","Blend until smooth using an immersion blender.","Stir in cream. Season with salt and pepper.","Serve with croutons and extra basil."]',
'italian', 'easy', 10, 40, 4, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800', @uid);

-- Italian: Caprese Salad
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Caprese Salad',
'A refreshing Italian salad of ripe tomatoes, fresh mozzarella, basil, and balsamic glaze.',
'["4 large ripe tomatoes sliced","250g fresh buffalo mozzarella sliced","Fresh basil leaves","Extra virgin olive oil","Balsamic glaze","Salt and flaky sea salt","Cracked black pepper"]',
'["Alternate slices of tomato and mozzarella on a serving plate.","Tuck fresh basil leaves between slices.","Drizzle generously with olive oil and balsamic glaze.","Season with salt and cracked pepper.","Let sit 10 minutes before serving."]',
'italian', 'easy', 10, 0, 4, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800', @uid);

-- Indian: Butter Chicken
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Butter Chicken (Murgh Makhani)',
'Tender chicken in a rich, creamy tomato-based sauce with warm spices. India most beloved curry.',
'["500g chicken thigh cubed","200g yogurt","2 tbsp butter chicken spice","2 tbsp butter","1 onion diced","3 cloves garlic","1 tsp ginger","400g crushed tomatoes","1 cup heavy cream","1 tsp fenugreek leaves","Salt","Fresh cilantro"]',
'["Marinate chicken in yogurt and spices for 1 hour.","Grill or broil chicken until charred. Set aside.","Melt butter and saute onion, garlic, and ginger until soft.","Add crushed tomatoes and simmer 15 minutes. Blend until smooth.","Return to pot. Add cream, fenugreek leaves, and chicken. Simmer 10 minutes.","Season with salt. Garnish with cilantro. Serve with naan and rice."]',
'indian', 'medium', 70, 30, 4, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800', @uid);

-- Mexican: Chicken Tacos al Pastor
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Chicken Tacos al Pastor',
'Marinated chicken tacos with pineapple, cilantro, and onion on warm corn tortillas.',
'["500g chicken thighs diced","1 cup pineapple diced","3 tbsp achiote paste","1/2 cup pineapple juice","2 cloves garlic","1 tsp cumin","Corn tortillas","Fresh cilantro","Diced onion","Lime wedges"]',
'["Marinate chicken with achiote paste, pineapple juice, garlic, and cumin for 2 hours.","Grill or pan-sear chicken until charred and cooked through.","Grill pineapple chunks until caramelized.","Warm tortillas on the grill.","Assemble tacos with chicken, pineapple, cilantro, and onion.","Serve with lime wedges and salsa."]',
'mexican', 'medium', 130, 15, 4, 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800', @uid);

-- Mexican: Guacamole
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Guacamole',
'Fresh and chunky guacamole with ripe avocados, lime, cilantro, and a kick of jalapeno.',
'["3 ripe avocados","1 jalapeno seeded minced","1/2 cup red onion diced","1/4 cup fresh cilantro chopped","2 tbsp lime juice","1 Roma tomato diced","Salt"]',
'["Halve avocados, remove pits, and scoop flesh into a bowl.","Mash with a fork to desired consistency.","Fold in jalapeno, onion, cilantro, tomato, and lime juice.","Season with salt. Serve immediately with tortilla chips."]',
'mexican', 'easy', 10, 0, 4, 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800', @uid);

-- Chinese: Kung Pao Chicken
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Kung Pao Chicken',
'Spicy Sichuan stir-fry with tender chicken, roasted peanuts, and dried chilies in a savory-sweet sauce.',
'["500g chicken breast cubed","1/2 cup roasted peanuts","10 dried red chilies","3 tbsp soy sauce","2 tbsp rice vinegar","1 tbsp sugar","1 tbsp cornstarch","2 cloves garlic","1 tsp ginger grated","2 green onions sliced","2 tbsp vegetable oil"]',
'["Mix soy sauce, vinegar, sugar, and cornstarch for the sauce.","Stir-fry chicken in hot oil until golden. Remove.","Fry dried chilies, garlic, and ginger for 30 seconds.","Return chicken, add sauce, and toss until coated.","Add peanuts and green onions. Toss and serve with rice."]',
'chinese', 'medium', 15, 10, 4, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800', @uid);

-- Chinese: Beef and Broccoli
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Beef and Broccoli Stir-fry',
'Tender flank steak and crisp broccoli in a savory garlic-ginger sauce. A takeout classic.',
'["400g flank steak sliced thin","2 cups broccoli florets","3 tbsp soy sauce","2 tbsp oyster sauce","1 tbsp cornstarch","1 tsp sugar","2 cloves garlic minced","1 tsp ginger grated","2 tbsp vegetable oil","Sesame seeds"]',
'["Marinate beef in 1 tbsp soy sauce and cornstarch for 15 minutes.","Blanch broccoli in boiling water for 1 minute. Drain.","Stir-fry beef in hot oil until browned. Remove.","Saute garlic and ginger for 30 seconds.","Return beef and broccoli. Add remaining sauces and sugar.","Toss until sauce coats everything. Serve with sesame seeds and rice."]',
'chinese', 'easy', 15, 10, 4, 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=800', @uid);

-- Japanese: Sushi Bowl
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Sushi Bowl (Chirashi)',
'A deconstructed sushi bowl with seasoned rice, fresh sashimi, avocado, cucumber, and garnishes.',
'["2 cups sushi rice","3 tbsp rice vinegar","1 tbsp sugar","300g fresh sashimi-grade salmon","1 avocado sliced","1 cucumber sliced","2 tbsp soy sauce","1 tsp wasabi","Pickled ginger","Nori strips","Sesame seeds"]',
'["Cook sushi rice and season with rice vinegar and sugar while warm.","Fan the rice to cool it to room temperature.","Slice salmon into thin pieces.","Arrange rice in bowls. Top with salmon, avocado, cucumber.","Garnish with nori strips, sesame seeds, and pickled ginger.","Serve with soy sauce and wasabi on the side."]',
'japanese', 'medium', 30, 20, 4, 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800', @uid);

-- Thai: Green Curry
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Thai Green Curry',
'Aromatic coconut milk curry with green curry paste, chicken, and Thai vegetables.',
'["400ml coconut milk","300g chicken breast sliced","3 tbsp green curry paste","1 cup Thai eggplant","1 cup bamboo shoots","2 kaffir lime leaves","1 tbsp fish sauce","1 tsp sugar","Thai basil","Jasmine rice"]',
'["Heat a splash of coconut cream in a wok. Fry green curry paste until fragrant.","Add chicken and stir-fry until sealed.","Pour in remaining coconut milk. Add kaffir lime leaves.","Add eggplant and bamboo shoots. Simmer 10 minutes.","Season with fish sauce and sugar.","Stir in Thai basil. Serve over jasmine rice."]',
'thai', 'medium', 10, 20, 4, 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=800', @uid);

-- American: Classic Cheeseburger
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Classic Cheeseburger',
'Juicy beef patty with melted cheddar, lettuce, tomato, and special sauce on a brioche bun.',
'["500g ground beef 80/20","4 brioche buns","4 slices cheddar cheese","Lettuce leaves","1 tomato sliced","1 red onion sliced","2 tbsp ketchup","1 tbsp mustard","1 tbsp mayo","Pickles","Salt and pepper"]',
'["Divide beef into 4 patties. Season generously with salt and pepper.","Grill or pan-sear patties 4 minutes per side for medium.","Place cheese on patties in the last minute. Cover to melt.","Toast buns on the grill until golden.","Mix ketchup, mustard, and mayo for special sauce.","Assemble: sauce, lettuce, tomato, patty, onion, pickles.","Serve with fries."]',
'american', 'easy', 10, 10, 4, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800', @uid);

-- American: Grilled Salmon with Lemon Dill Sauce
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Grilled Salmon with Lemon Dill Sauce',
'Perfectly grilled salmon fillets with a creamy lemon dill sauce. Light, healthy, and elegant.',
'["4 salmon fillets 150g each","2 tbsp olive oil","1 lemon","2 cloves garlic minced","1/2 cup sour cream","2 tbsp fresh dill chopped","1 tsp Dijon mustard","Salt and pepper","Asparagus for serving"]',
'["Season salmon with salt, pepper, and olive oil.","Grill skin-side down over medium-high heat for 4 minutes.","Flip and cook 3 more minutes for medium.","Mix sour cream, dill, lemon juice, garlic, and mustard for sauce.","Serve salmon with sauce drizzled over and grilled asparagus on the side."]',
'american', 'easy', 10, 10, 4, 'https://images.unsplash.com/photo-1519974719765-e6559eac2575?w=800', @uid);

-- American: Fluffy Pancakes
INSERT INTO recipes (title, description, ingredients, instructions, cuisine, difficulty, prep_time, cook_time, servings, image_url, created_by)
VALUES ('Fluffy Buttermilk Pancakes',
'Light and fluffy buttermilk pancakes golden on the outside, soft on the inside. The perfect weekend breakfast.',
'["2 cups all-purpose flour","2 tbsp sugar","2 tsp baking powder","1 tsp baking soda","1/2 tsp salt","2 cups buttermilk","2 large eggs","1/4 cup melted butter","1 tsp vanilla","Maple syrup","Fresh berries"]',
'["Mix flour, sugar, baking powder, baking soda, and salt in a bowl.","In another bowl, whisk buttermilk, eggs, melted butter, and vanilla.","Pour wet into dry. Stir until just combined. Lumps are OK.","Heat a griddle over medium heat. Pour 1/4 cup batter per pancake.","Cook until bubbles form on surface, then flip and cook 1 more minute.","Serve stacked with maple syrup, fresh berries, and butter."]',
'american', 'easy', 10, 15, 4, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800', @uid);
