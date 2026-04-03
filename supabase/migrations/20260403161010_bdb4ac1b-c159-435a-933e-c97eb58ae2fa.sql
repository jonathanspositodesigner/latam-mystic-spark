
DELETE FROM email_confirmation_tokens WHERE email = 'jonathandesigner1993@gmail.com';
DELETE FROM device_signups WHERE user_id IN (SELECT id FROM profiles WHERE email = 'jonathandesigner1993@gmail.com');
DELETE FROM profiles WHERE email = 'jonathandesigner1993@gmail.com';
