const { getFeed } = require('../src/modules/feed/feed.service');
const { supabaseAdmin } = require('../src/config/supabase');

async function test() {
  try {
    // Fetch a user from database who has tags or profiles
    const { data: profiles } = await supabaseAdmin
      .from('user_profiles')
      .select('id, departments, hobbies, master_skills')
      .limit(10);
    
    console.log('Profiles retrieved:', profiles.length);
    const profileWithTags = profiles.find(p => 
      (p.departments && p.departments.length > 0) || 
      (p.hobbies && p.hobbies.length > 0) || 
      (p.master_skills && p.master_skills.length > 0)
    );

    if (!profileWithTags) {
      console.log('No profile with tags found in database.');
      return;
    }

    console.log('Testing getFeed for user with tags:', profileWithTags.id);
    const feed = await getFeed(profileWithTags.id, { pageSize: 10 });
    console.log('Feed fetched successfully! Count:', feed.data.length);
  } catch (err) {
    console.error('Error testing feed:', err);
  }
}

test().then(() => process.exit(0));
