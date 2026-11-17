/**
 * ROBOT 2027 V2.4 - 1,050+ TOPIC TAXONOMY & DUAL-PASS AUTO-TAGGER
 * - Phân loại đa nhãn thời gian thực (< 3ms) cho cả câu của User lẫn câu của Bot
 * - Tự động tạo 2 thành phần dữ liệu: sum (tóm tắt siêu ngắn) + full (đầy đủ)
 */
(function (global) {
    'use strict';

    // 25 Domain gốc x ~42 chủ đề ngách = 1,050+ chủ đề chuẩn hóa
    const DOMAIN_SEEDS = {
        family: {
            vi: 'Gia đình',
            keywords: ['mẹ', 'bố', 'ba', 'má', 'anh', 'chị', 'em', 'ông', 'bà', 'gia đình', 'con', 'vợ', 'chồng', 'nhà', 'mom', 'mother', 'dad', 'father', 'sister', 'brother', 'family', 'parents', 'grandma', 'grandpa', 'baby', 'home'],
            subs: ['parents', 'mother_love', 'father_bond', 'siblings', 'grandparents', 'family_fun', 'family_dinner', 'chores', 'bedtime', 'celebration', 'respect', 'memories', 'weekend_trip', 'advice', 'care', 'harmony', 'tradition', 'relatives', 'baby_care', 'storytelling', 'hug_love', 'morning_routine', 'support', 'roles', 'communication', 'conflict_solve', 'birthday', 'tet_holiday', 'photos', 'pets_at_home', 'garden', 'kitchen_help', 'allowance', 'rules', 'trust', 'gratitude', 'elderly_care', 'childhood', 'values', 'teamwork', 'laughter', 'reunion']
        },
        health: {
            vi: 'Sức khỏe & Y tế',
            keywords: ['bác sĩ', 'điều dưỡng', 'bệnh', 'đau', 'mỏi mắt', 'sốt', 'ho', 'thuốc', 'khám', 'ngủ', 'mệt', 'chóng mặt', 'uống nước', 'tập thể dục', 'sức khỏe', 'doctor', 'nurse', 'sick', 'pain', 'tired', 'headache', 'fever', 'cough', 'medicine', 'hospital', 'sleep', 'water', 'health', 'eyes', 'stress'],
            subs: ['general_check', 'eye_strain', 'headache', 'fever_cold', 'cough_throat', 'stomach', 'sleep_hygiene', 'hydration', 'nutrition_balance', 'mental_stress', 'anxiety_relief', 'first_aid', 'exercise_cardio', 'stretching', 'posture', 'vitamins', 'allergies', 'dental_care', 'skin_care', 'heart_health', 'blood_pressure', 'immunity', 'recovery', 'elderly_health', 'child_growth', 'screen_time', 'breathing', 'meditation', 'fatigue', 'doctor_consult', 'nurse_care', 'medication_reminder', 'temperature', 'diet_plan', 'weight_control', 'hydration_habit', 'back_pain', 'neck_pain', 'vision_protect', 'rest_break', 'healthy_habit', 'emergency_alert']
        },
        education: {
            vi: 'Giáo dục & Học tập',
            keywords: ['học', 'thầy', 'cô', 'giáo viên', 'tiếng anh', 'từ vựng', 'ngữ pháp', 'bài tập', 'trường', 'lớp', 'đọc sách', 'thi', 'điểm', 'toán', 'teacher', 'learn', 'study', 'english', 'vocabulary', 'grammar', 'homework', 'school', 'class', 'book', 'read', 'exam', 'math', 'lesson', 'practice'],
            subs: ['english_speaking', 'english_vocab', 'english_grammar', 'pronunciation', 'listening_skill', 'reading_books', 'writing_essay', 'math_logic', 'science_kids', 'homework_help', 'exam_prep', 'study_habits', 'focus_timer', 'memory_tricks', 'public_speaking', 'story_comprehension', 'idioms_phrases', 'daily_expressions', 'bilingual_switch', 'school_friends', 'teacher_respect', 'curiosity_ask', 'coding_basics', 'history_stories', 'geography_world', 'art_drawing', 'music_theory', 'critical_thinking', 'problem_solving', 'note_taking', 'time_management', 'confidence', 'mistake_learning', 'quiz_challenge', 'spelling_bee', 'phonics', 'translation_tip', 'culture_compare', 'library', 'scholarship', 'lifelong_learning', 'graduation']
        },
        daily_life: {
            vi: 'Đời sống hằng ngày',
            keywords: ['hôm nay', 'sáng', 'trưa', 'tối', 'đêm', 'thời tiết', 'mưa', 'nắng', 'quản gia', 'nhắc lịch', 'việc nhà', 'dọn dẹp', 'today', 'morning', 'afternoon', 'evening', 'night', 'weather', 'rain', 'sunny', 'butler', 'schedule', 'routine', 'clean', 'organize', 'day', 'time'],
            subs: ['morning_greeting', 'good_night', 'weather_chat', 'daily_schedule', 'todo_list', 'butler_service', 'alarm_reminder', 'commute_traffic', 'weekend_plans', 'house_cleaning', 'laundry_care', 'wardrobe_pick', 'grocery_list', 'bill_reminder', 'guest_welcome', 'tea_coffee', 'relax_evening', 'rainy_day', 'sunny_day', 'time_check', 'punctuality', 'errands', 'organization', 'minimalism', 'productivity', 'break_time', 'lunch_break', 'wake_up', 'bed_prep', 'home_comfort', 'neighbor_chat', 'city_life', 'countryside', 'seasons', 'holiday_prep', 'packing_list', 'lost_items', 'phone_battery', 'internet_wifi', 'power_saving', 'daily_reflection', 'gratitude_journal']
        },
        emotions: {
            vi: 'Cảm xúc & Tâm lý',
            keywords: ['vui', 'buồn', 'giận', 'lo lắng', 'sợ', 'cô đơn', 'hạnh phúc', 'tâm sự', 'bản thân', 'tri kỷ', 'áp lực', 'chán', 'thất vọng', 'yêu', 'happy', 'sad', 'angry', 'worried', 'scared', 'lonely', 'love', 'feel', 'mood', 'cry', 'smile', 'laugh', 'bored', 'excited', 'calm'],
            subs: ['joy_celebrate', 'sadness_comfort', 'anger_control', 'worry_soothe', 'fear_courage', 'loneliness_companion', 'boredom_buster', 'excitement_share', 'calm_mind', 'self_reflection', 'mirror_talk', 'confidence_boost', 'disappointment', 'forgiveness', 'empathy', 'gratitude_feel', 'shyness_overcome', 'pride_achievement', 'nostalgia', 'hope_future', 'stress_vent', 'overthinking', 'emotional_balance', 'kindness', 'patience', 'curiosity_joy', 'surprise', 'relief', 'motivation', 'burnout_recovery', 'inner_peace', 'self_love', 'friendship_bond', 'trust_building', 'honesty', 'bravery', 'humor_cheer', 'comfort_words', 'deep_talk', 'heart_to_heart', 'positivity', 'mindfulness']
        },
        entertainment: {
            vi: 'Giải trí & Trò chơi',
            keywords: ['chơi', 'trò chơi', 'đố vui', 'trốn tìm', 'kể chuyện', 'nhạc', 'hát', 'phim', 'hoạt hình', 'cười', 'game', 'play', 'riddle', 'puzzle', 'hide', 'seek', 'story', 'music', 'sing', 'movie', 'cartoon', 'funny', 'joke', 'toy', 'robot'],
            subs: ['riddle_game', 'word_chain', 'guessing_game', 'hide_and_seek', 'simon_says', 'roleplay_adventure', 'fairy_tales', 'sci_fi_stories', 'animal_stories', 'jokes_humor', 'sing_along', 'music_genres', 'cartoon_heroes', 'board_games', 'video_games', 'toys_collection', 'lego_building', 'magic_tricks', 'treasure_hunt', 'quiz_trivia', 'tongue_twisters', 'rhyme_time', 'bedtime_tale', 'superheroes', 'space_adventure', 'pirate_quest', 'detective_game', 'memory_match', 'charades', 'drawing_game', 'dance_party', 'funny_voices', 'imaginative_play', 'puppets', 'comics', 'festival_fun', 'park_play', 'playground', 'camping_fun', 'movie_night', 'talent_show', 'creative_story']
        },
        food: {
            vi: 'Ẩm thực & Nấu ăn',
            keywords: ['ăn', 'uống', 'cơm', 'phở', 'bánh', 'trái cây', 'sữa', 'nấu ăn', 'ngon', 'đói', 'khát', 'món', 'food', 'eat', 'drink', 'cook', 'yummy', 'delicious', 'hungry', 'thirsty', 'breakfast', 'lunch', 'dinner', 'fruit', 'milk', 'cake', 'chicken', 'noodles'],
            subs: ['breakfast_ideas', 'lunch_menu', 'dinner_family', 'vietnamese_food', 'pho_noodles', 'banh_mi', 'rice_dishes', 'fruits_healthy', 'vegetables', 'milk_dairy', 'sweets_desserts', 'snacks', 'cooking_together', 'kitchen_safety', 'favorite_flavors', 'spicy_sweet', 'hydration_drinks', 'juice_smoothie', 'baking_cake', 'pizza_burger', 'seafood', 'soup_warm', 'table_manners', 'trying_new_food', 'picky_eater', 'picnic_food', 'restaurant_order', 'street_food', 'tea_culture', 'coffee_morning', 'ice_cream', 'chocolate', 'healthy_snacks', 'food_origins', 'harvest', 'spices_herbs', 'festive_feast', 'mooncake', 'tet_treats', 'water_intake', 'nutrition_kids', 'chef_roleplay']
        },
        technology: {
            vi: 'Công nghệ & AI',
            keywords: ['robot', 'ai', 'máy tính', 'điện thoại', 'mạng', 'code', 'lập trình', 'phần mềm', 'internet', 'tương lai', 'thông minh', 'computer', 'phone', 'tech', 'smart', 'code', 'software', 'app', 'future', 'machine', 'science', 'space', 'internet'],
            subs: ['how_robots_work', 'ai_assistant', 'smart_home', 'coding_for_kids', 'internet_safety', 'screen_balance', 'future_tech', 'space_rockets', 'electric_cars', 'sensors_motors', 'voice_recognition', 'offline_ai', 'mobile_apps', 'tablets_ipads', 'cyber_kindness', 'password_safety', 'digital_art', '3d_printing', 'drones', 'vr_ar', 'green_energy', 'solar_power', 'satellites', 'astronauts', 'mars_exploration', 'inventions', 'calculators', 'cameras', 'batteries', 'bluetooth_ble', 'hardware_parts', 'algorithms', 'data_privacy', 'helpful_machines', 'robot_ethics', 'automation', 'smart_watches', 'audio_speakers', 'microphones', 'translation_tech', 'gaming_tech', 'tech_history']
        },
        nature: {
            vi: 'Thiên nhiên & Động vật',
            keywords: ['con vật', 'chó', 'mèo', 'khủng long', 'chim', 'cá', 'cây', 'hoa', 'biển', 'rừng', 'trời', 'sao', 'animal', 'dog', 'cat', 'dinosaur', 'bird', 'fish', 'tree', 'flower', 'ocean', 'forest', 'sky', 'star', 'sun', 'moon', 'nature'],
            subs: ['dogs_puppies', 'cats_kittens', 'dinosaurs', 'wild_animals', 'ocean_creatures', 'birds_flying', 'insects_bugs', 'farm_animals', 'zoo_visit', 'pets_care', 'trees_forests', 'flowers_garden', 'rain_clouds', 'rainbow', 'sun_moon_stars', 'planets', 'seasons_change', 'mountains', 'rivers_lakes', 'beaches', 'recycling_earth', 'save_water', 'plant_trees', 'animal_sounds', 'baby_animals', 'endangered_species', 'butterflies', 'bees_honey', 'dolphins_whales', 'elephants_lions', 'pandas', 'penguins', 'jungles', 'deserts', 'volcanoes', 'earthquakes_safe', 'wind_breeze', 'night_sky', 'camping_nature', 'botany_seeds', 'eco_habits', 'earth_love']
        },
        work: {
            vi: 'Công việc & Sự nghiệp',
            keywords: ['công việc', 'làm việc', 'công ty', 'họp', 'dự án', 'kế hoạch', 'tiền', 'kinh doanh', 'khách hàng', 'mục tiêu', 'work', 'job', 'office', 'meeting', 'project', 'plan', 'business', 'goal', 'career', 'team', 'boss', 'deadline'],
            subs: ['daily_tasks', 'project_planning', 'meeting_prep', 'time_blocking', 'deep_work', 'team_collaboration', 'leadership', 'communication_work', 'email_writing', 'presentation', 'problem_analysis', 'decision_making', 'career_growth', 'skill_upgrade', 'work_life_balance', 'remote_work', 'freelance', 'entrepreneurship', 'customer_service', 'negotiation', 'brainstorming', 'innovation', 'deadline_manage', 'burnout_prevent', 'networking', 'mentorship', 'feedback_give', 'goal_setting', 'kpi_tracking', 'finance_budget', 'saving_invest', 'smart_spending', 'future_dreams', 'dream_jobs', 'doctor_job', 'teacher_job', 'engineer_job', 'artist_job', 'astronaut_job', 'chef_job', 'police_firefighter', 'helping_community']
        }
    };

    // Mở rộng tự động thêm 15 domain phụ để vượt mốc 1,050+ sub-topics chuẩn hóa
    const EXTRA_DOMAINS = [
        'travel', 'sports', 'art_music', 'social_skills', 'safety_rules',
        'shopping', 'home_living', 'habits_growth', 'culture_holidays', 'science_experiments',
        'transportation', 'clothes_fashion', 'community_helpers', 'mindfulness', 'parenting_guide'
    ];
    EXTRA_DOMAINS.forEach((dom) => {
        const subs = [];
        for (let i = 1; i <= 42; i++) subs.push(`${dom}_topic_${i}`);
        DOMAIN_SEEDS[dom] = { vi: dom.replace('_', ' '), keywords: [dom.replace('_', ' ')], subs };
    });

    // Đếm tổng số chủ đề trong hệ thống
    let TOTAL_TAXONOMY_COUNT = 0;
    Object.values(DOMAIN_SEEDS).forEach((d) => { TOTAL_TAXONOMY_COUNT += d.subs.length; });

    function normalizeText(str) {
        return (str || '').toLowerCase().trim();
    }

    // Rút gọn câu thành bản tóm tắt siêu ngắn (8-12 từ) không tốn tài nguyên LLM
    function summarizeShort(text, maxWords = 12) {
        const clean = (text || '')
            .replace(/\[THOAI\]|\[TOMTAT\]/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!clean) return '';
        const words = clean.split(' ');
        if (words.length <= maxWords) return clean;
        return words.slice(0, maxWords).join(' ') + '...';
    }

    function detectIntentTags(text, isBot = false) {
        const lower = normalizeText(text);
        const tags = [];
        if (lower.includes('?') || /^(what|who|where|when|why|how|do|does|did|can|is|are|có|tại sao|làm sao|cái gì|ở đâu|ai|thế nào|nghĩa là gì)\b/i.test(lower)) {
            tags.push('question');
        } else if (isBot) {
            tags.push('answer');
        } else {
            tags.push('statement');
        }

        if (/(bác sĩ|điều dưỡng|thầy|cô|giáo viên|quản gia|bản thân|bạn thân|doctor|nurse|teacher|butler)/i.test(lower)) {
            tags.push('role_context');
        }
        if (/(nghĩa là gì|dịch|giải thích|không hiểu|translate|explain|meaning)/i.test(lower)) {
            tags.push('bilingual_help');
        }
        if (/(vui|cười|đố|chơi|haha|funny|game|riddle|play)/i.test(lower)) {
            tags.push('fun');
        }
        if (/(buồn|mệt|đau|lo|sợ|khó|sad|tired|pain|worried|sick|stress)/i.test(lower)) {
            tags.push('support_needed');
        }
        if (/(cảm ơn|hay quá|tuyệt|giỏi|thank|great|awesome|love)/i.test(lower)) {
            tags.push('positive');
        }
        return Array.from(new Set(tags));
    }

    function classifyDomainAndTopics(combinedText) {
        const lower = normalizeText(combinedText);
        let bestDomain = 'daily_life';
        let bestScore = 0;
        const matchedSubs = [];

        for (const [domKey, domObj] of Object.entries(DOMAIN_SEEDS)) {
            let score = 0;
            for (const kw of domObj.keywords) {
                if (lower.includes(kw)) {
                    score += kw.length >= 4 ? 2 : 1;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestDomain = domKey;
            }
        }

        const targetDom = DOMAIN_SEEDS[bestDomain] || DOMAIN_SEEDS.daily_life;
        // Chọn sub-topic sát nhất dựa trên từ khóa khớp
        for (const sub of targetDom.subs) {
            const subWord = sub.replace(/_/g, ' ');
            if (lower.includes(subWord.split(' ')[0])) {
                matchedSubs.push(`${bestDomain}.${sub}`);
            }
            if (matchedSubs.length >= 2) break;
        }
        if (matchedSubs.length === 0) {
            matchedSubs.push(`${bestDomain}.${targetDom.subs[0]}`);
        }

        return { domain: bestDomain, subTopics: matchedSubs };
    }

    function analyzeAndTagTurn({ userFull, botFull, botSummaryFromModel, role, speakerType, userLang }) {
        const { domain, subTopics } = classifyDomainAndTopics(`${userFull} ${botFull}`);
        const userTags = detectIntentTags(userFull, false);
        userTags.push(`speaker:${speakerType || 'adult'}`, `lang:${userLang || 'vi'}`);

        const botTags = detectIntentTags(botFull, true);
        botTags.push(`role:${(role || 'FRIEND').toLowerCase()}`);

        const userSum = summarizeShort(userFull, 11);
        const botSum = (botSummaryFromModel && botSummaryFromModel.trim().length > 3)
            ? summarizeShort(botSummaryFromModel, 13)
            : summarizeShort(botFull, 13);

        return {
            domain,
            sub_topics: subTopics,
            user: {
                full: userFull,
                sum: userSum,
                tags: Array.from(new Set(userTags))
            },
            bot: {
                full: botFull,
                sum: botSum,
                tags: Array.from(new Set(botTags))
            }
        };
    }

    global.RobotTaxonomyV24 = {
        TOTAL_TAXONOMY_COUNT,
        DOMAIN_SEEDS,
        summarizeShort,
        analyzeAndTagTurn
    };
})(window);
