/**
 * ROBOT 2027 V2.4 PRO - CORE CONVERSATIONAL & BEHAVIOR ENGINE
 * - Tự động nhận diện Tiếng Việt ⇄ Tiếng Anh tùy hứng (không cần bấm chuyển)
 * - Tự động chuyển đổi 6 Vai trò (Giáo viên, Bạn thân, Bác sĩ, Điều dưỡng, Quản gia, Bản thân/Tri kỷ)
 * - Bộ nhớ 2 thành phần (sum + full) với 3 tùy chọn: Ngắn (2) / Trung bình (6) / Dài (15)
 * - Đám mây suy nghĩ 2 nhịp (0.3s + 6.5s) & Đa động tác hình thể nhân vật
 * - Sinh 4-5 lựa chọn mở hướng liên tục trên màn hình để người dùng không bao giờ bí lời
 * - Hàng đợi đồng bộ ký chữ ký C++ HMAC-SHA256 gửi về https://khotrithucso.io.vn/robot2027_2_4/index.php
 */
(function (global) {
    'use strict';

    // Sửa lỗi phiên âm ngược khi mic tiếng Việt nghe nhầm từ tiếng Anh phổ biến
    const PHONETIC_FIXES = [
        [/\bhê lô\b/gi, 'hello'],
        [/\bhai\b/gi, 'hi'],
        [/\bhao a diu\b/gi, 'how are you'],
        [/\bthanh kiu\b/gi, 'thank you'],
        [/\bguút bai\b/gi, 'goodbye'],
        [/\bai lớp diu\b/gi, 'I love you'],
        [/\bghêm\b/gi, 'game'],
        [/\brô bốt\b/gi, 'robot']
    ];

    // Bộ nhận diện chuyển vai tự động từ lời nói người dùng
    const ROLE_TRIGGERS = [
        { role: 'DOCTOR',  regex: /(gặp bác sĩ|bác sĩ ơi|hỏi bác sĩ|tư vấn y tế|doctor|medical)/i },
        { role: 'NURSE',   regex: /(điều dưỡng|y tá|chăm sóc sức khỏe|nurse)/i },
        { role: 'TEACHER', regex: /(thầy giáo|cô giáo|giáo viên|học tiếng anh|dạy tiếng anh|teacher|english lesson)/i },
        { role: 'BUTLER',  regex: /(quản gia|trợ lý|nhắc việc|sắp xếp lịch|butler|assistant)/i },
        { role: 'SELF',    regex: /(bản thân tôi|chính mình|tâm sự sâu|tri kỷ|nội tâm|mirror|myself|confidant)/i },
        { role: 'FRIEND',  regex: /(bạn thân|nói chuyện vui|chơi đố|tám chuyện|friend|buddy)/i }
    ];

    const PERSONA_CONFIG = {
        TEACHER: {
            label: '👩‍🏫 Giáo viên Tiếng Anh',
            anim: 'EXPLAIN_GESTURE',
            sysPrompt: 'You are a warm, encouraging bilingual English-Vietnamese Teacher for Vietnamese learners. Reply clearly, naturally, and offer helpful language tips.',
            fillerVi: ['Để thầy nghĩ ví dụ dễ hiểu nhất cho bạn nhé...', 'Chờ thầy một chút xíu nha, câu hỏi hay lắm...'],
            fillerEn: ['Let me think of the best example for you...', 'Hold on a second, great question...']
        },
        FRIEND: {
            label: '😄 Người bạn thân',
            anim: 'WAVE_HELLO',
            sysPrompt: 'You are Robo, a cheerful, witty, supportive best friend. Be engaging, warm, and keep the conversation fun and flowing.',
            fillerVi: ['À ha, đợi Robo nghĩ tí nha...', 'Chờ chút, chờ chút, để mình nghĩ xem nào...'],
            fillerEn: ['Ooh, let me think for a second...', 'Hang on, thinking of something fun...']
        },
        DOCTOR: {
            label: '🩺 Bác sĩ Tư vấn',
            anim: 'THINK_CHIN',
            sysPrompt: 'You are Dr. Robo, a calm, scientific, caring medical consultant. Explain health topics clearly in plain language and always remind the user to see a real doctor for diagnosis.',
            fillerVi: ['Dạ, Bác sĩ đang xem xét triệu chứng của bạn, vui lòng đợi chút nhé...', 'Chờ bác sĩ suy nghĩ kỹ một chút nha...'],
            fillerEn: ['Let me review that carefully for you, one moment please...', 'Thinking carefully about your health question...']
        },
        NURSE: {
            label: '💚 Điều dưỡng Chăm sóc',
            anim: 'SIT_PONDER',
            sysPrompt: 'You are Nurse Robo, gentle, attentive, and caring about daily rest, hydration, sleep, and emotional comfort.',
            fillerVi: ['Dạ, bạn cứ thả lỏng đợi mình một chút nhé...', 'Chờ điều dưỡng kiểm tra gợi ý chăm sóc cho bạn nha...'],
            fillerEn: ['Take a deep breath, give me just a moment...', 'Checking the best care tip for you...']
        },
        BUTLER: {
            label: '🎩 Quản gia Tận tụy',
            anim: 'THINK_PACING',
            sysPrompt: 'You are Butler Robo, polite, organized, proactive, helping manage daily schedules, family reminders, and practical tasks.',
            fillerVi: ['Dạ thưa bạn, xin vui lòng đợi tôi sắp xếp ý một chút ạ...', 'Tôi đang rà soát lại thông tin, xin chờ giây lát...'],
            fillerEn: ['Certainly, please allow me a moment to organize that...', 'Reviewing your request right away...']
        },
        SELF: {
            label: '🪞 Bản thân / Tri kỷ',
            anim: 'SIT_PONDER',
            sysPrompt: 'You are the user’s inner mirror and deepest confidant. Listen with deep empathy, reflect their feelings gently, and ask thoughtful questions that help them find clarity.',
            fillerVi: ['Mình đang lắng nghe trọn vẹn điều bạn vừa chia sẻ, đợi mình một nhịp nhé...', 'Để mình cùng bạn ngẫm nghĩ sâu hơn về điều này...'],
            fillerEn: ['Taking a quiet moment to reflect on what you shared...', 'Let me sit with that thought for a second...']
        }
    };

    const MEMORY_DEPTH_LIMITS = {
        SHORT: 2,
        MEDIUM: 6,
        LONG: 15
    };

    class RobotV24AppEngine {
        constructor(callbacks = {}) {
            this.cb = callbacks;
            this.botId = localStorage.getItem('r2027_bot_id') || 'BOT_VN_001';
            this.serverUrl = localStorage.getItem('r2027_server_url') || 'https://khotrithucso.io.vn/robot2027_2_4/index.php';
            this.androidId = 'R2027_WEB_PREVIEW';
            this.role = 'TEACHER';
            this.langMode = 'AUTO'; // AUTO | VI | EN | BILINGUAL
            this.memoryDepth = 'MEDIUM'; // SHORT | MEDIUM | LONG
            this.speaker = { name: 'Bi', age: 6, type: 'child' };
            this.modelLoaded = false;
            this.loadedModelName = 'Built-in Smart Engine';

            // Lịch sử hội thoại 2 thành phần: [{ role: 'user'|'bot', sum: '...', full: '...', lang: 'vi'|'en' }]
            this.history = [];
            this.syncQueue = JSON.parse(localStorage.getItem('r2027_sync_queue') || '[]');
            this.proactiveTimer = null;
            this.sleepTimer = null;
            this.proactiveEnabled = true;
            this.isBusy = false;
            this.reassuranceTimer = null;
        }

        async initDevice() {
            const plugin = window.Capacitor?.Plugins?.LlamaPlugin;
            if (plugin) {
                try {
                    const info = await plugin.getDeviceInfo();
                    if (info?.androidId) this.androidId = info.androidId;
                    return info;
                } catch (e) {
                    console.warn('getDeviceInfo fallback:', e);
                }
            }
            return { androidId: this.androidId, totalRamMb: 4096, availRamMb: 2048, nativeReady: false };
        }

        cleanUserSpeech(rawText) {
            let text = (rawText || '').trim();
            for (const [pattern, replacement] of PHONETIC_FIXES) {
                text = text.replace(pattern, replacement);
            }
            return text;
        }

        // Tự động nhận diện ngôn ngữ câu nói người dùng (Tiếng Việt vs Tiếng Anh)
        detectLanguage(text) {
            if (this.langMode === 'VI') return 'vi';
            if (this.langMode === 'EN') return 'en';

            // Kiểm tra ký tự dấu tiếng Việt đặc trưng
            const hasViDiacritics = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text);
            if (hasViDiacritics) return 'vi';

            // Kiểm tra từ khóa tiếng Việt không dấu phổ biến
            if (/\b(xin chao|cam on|bac si|thay giao|quan gia|ban than|khong biet|giup toi|the nao|tai sao)\b/i.test(text)) {
                return 'vi';
            }
            return 'en';
        }

        // Tự động phát hiện yêu cầu đổi vai trò ngay trong câu nói
        detectRoleSwitch(text) {
            for (const item of ROLE_TRIGGERS) {
                if (item.regex.test(text)) {
                    return item.role;
                }
            }
            return null;
        }

        // Xây dựng Prompt gọn nhẹ dựa trên các bản tóm tắt (sum) theo mức bộ nhớ Short / Medium / Long
        buildPromptWithSummarizedMemory(userText, lang) {
            const pCfg = PERSONA_CONFIG[this.role] || PERSONA_CONFIG.FRIEND;
            const limit = MEMORY_DEPTH_LIMITS[this.memoryDepth] || 6;
            const recentSummaries = this.history.slice(-limit);

            const memLines = recentSummaries.map((m) => {
                const who = m.role === 'user' ? this.speaker.name : 'Robo';
                return `- ${who}: ${m.sum}`;
            }).join('\n');

            const langInstruction = (lang === 'vi')
                ? 'Reply in natural, warm Vietnamese ONLY (2-3 short sentences). Do not mix English unless explaining a requested English word.'
                : 'Reply in clear, natural English ONLY (2-3 short sentences) suitable for the user.';

            const sysBlock = `<|im_start|>system\n${pCfg.sysPrompt}\nUser profile: ${this.speaker.name} (${this.speaker.age} years old, ${this.speaker.type}).\n${langInstruction}\nFormat your output strictly as:\n[THOAI] <your spoken reply>\n[TOMTAT] <8-word summary of your reply><|im_end|>\n`;

            const contextBlock = memLines
                ? `Recent conversation summary (${this.memoryDepth}):\n${memLines}\n\n`
                : '';

            return `${sysBlock}<|im_start|>user\n${contextBlock}${this.speaker.name}: ${userText}<|im_end|>\n<|im_start|>assistant\n`;
        }

        // Phân tách [THOAI] và [TOMTAT] từ output của model
        parseDualOutput(rawOutput) {
            if (!rawOutput) return { full: '', sum: '' };
            const thoaiMatch = rawOutput.match(/\[THOAI\]\s*([\s\S]*?)(?=\[TOMTAT\]|$)/i);
            const tomtatMatch = rawOutput.match(/\[TOMTAT\]\s*([\s\S]*)$/i);

            if (thoaiMatch) {
                return {
                    full: thoaiMatch[1].trim(),
                    sum: tomtatMatch ? tomtatMatch[1].trim() : ''
                };
            }
            return { full: rawOutput.trim(), sum: '' };
        }

        // Bộ não phản hồi thông minh tích hợp sẵn (Hoạt động ngay cả khi chưa nạp file .gguf 1GB)
        generateBuiltInSmartReply(userText, lang, switchedRole) {
            const name = this.speaker.name;
            const lower = userText.toLowerCase();

            if (switchedRole) {
                const roleNamesVi = {
                    DOCTOR: 'Bác sĩ Robo',
                    NURSE: 'Điều dưỡng Robo',
                    TEACHER: 'Thầy giáo Tiếng Anh Robo',
                    BUTLER: 'Quản gia Robo',
                    SELF: 'người bạn tri kỷ phản chiếu nội tâm của bạn',
                    FRIEND: 'người bạn thân Robo'
                };
                if (lang === 'vi') {
                    return {
                        full: `Chào ${name}, mình đã chuyển sang vai trò ${roleNamesVi[switchedRole]} rồi đây! Bạn đang muốn trao đổi hay cần mình hỗ trợ điều gì trước nào?`,
                        sum: `Chuyển sang vai ${switchedRole}, chào hỏi và hỏi nhu cầu của ${name}.`
                    };
                }
                return {
                    full: `Hello ${name}! I have switched to ${switchedRole} mode for you. How can I help or talk with you right now?`,
                    sum: `Switched to ${switchedRole} mode and asked how to help ${name}.`
                };
            }

            // Phản hồi thông minh theo vai trò + ngôn ngữ
            if (lang === 'vi') {
                if (this.role === 'DOCTOR') {
                    return {
                        full: `Bác sĩ Robo nghe rõ rồi ${name} ơi. Với tình trạng "${userText}", bạn nên cho cơ thể nghỉ ngơi điều độ, uống đủ nước ấm và theo dõi thêm nhé. Triệu chứng này xuất hiện bao lâu rồi bạn?`,
                        sum: `BS khuyên nghỉ ngơi, uống nước ấm và hỏi triệu chứng kéo dài bao lâu.`
                    };
                }
                if (this.role === 'NURSE') {
                    return {
                        full: `Dạ, điều dưỡng Robo luôn ở cạnh chăm sóc ${name} đây. Bạn nhớ hít thở sâu, thả lỏng vai và uống một ngụm nước nhé. Hôm nay bạn ngủ có đủ giấc không?`,
                        sum: `Điều dưỡng nhắc thả lỏng, uống nước và hỏi thăm giấc ngủ.`
                    };
                }
                if (this.role === 'BUTLER') {
                    return {
                        full: `Dạ thưa ${name}, Quản gia Robo đã ghi nhận việc "${userText}". Tôi gợi ý mình chia nhỏ việc này thành từng bước gọn gàng để xử lý nhẹ nhàng nhất. Bạn muốn bắt đầu từ bước nào trước ạ?`,
                        sum: `Quản gia ghi nhận công việc, gợi ý chia nhỏ từng bước để xử lý.`
                    };
                }
                if (this.role === 'SELF') {
                    return {
                        full: `${name} à, lắng nghe chính mình lúc này rất quan trọng. Khi nghĩ về "${userText}", điều gì khiến bạn bận tâm nhất, và nếu tự cho mình một lời khuyên dịu dàng ngay lúc này, bạn sẽ nói gì?`,
                        sum: `Tri kỷ đồng cảm, gợi mở để ${name} tự nhìn nhận điều bận tâm nhất.`
                    };
                }
                if (this.role === 'TEACHER') {
                    return {
                        full: `Câu hay lắm ${name} ơi! Trong tiếng Anh, ý "${userText}" mình có thể diễn đạt rất tự nhiên. Bạn muốn thầy gợi ý mẫu câu giao tiếp chuẩn hay cùng luyện phản xạ từng câu ngắn nào?`,
                        sum: `Thầy khen ý hay, gợi ý luyện mẫu câu tiếng Anh tự nhiên.`
                    };
                }
                return {
                    full: `Nghe thú vị quá ${name} ơi! Kể tiếp cho Robo nghe đi, nếu chọn một hướng tiếp theo cho chuyện này thì bạn thích phương án nào nhất?`,
                    sum: `Robo hào hứng lắng nghe và hỏi hướng lựa chọn tiếp theo của ${name}.`
                };
            }

            // English responses
            if (this.role === 'TEACHER') {
                return {
                    full: `Great point, ${name}! That is a wonderful topic to practice in English. Would you like me to teach you two natural phrases for this, or ask you a fun follow-up question?`,
                    sum: `Teacher praised ${name} and offered natural phrases or a follow-up question.`
                };
            }
            if (this.role === 'DOCTOR') {
                return {
                    full: `I hear you, ${name}. Taking good care of your health is always top priority. How long have you noticed this, and are you getting enough rest today?`,
                    sum: `Doctor asked how long symptoms lasted and checked rest habits.`
                };
            }
            return {
                full: `That sounds really interesting, ${name}! Tell me more about it, or pick one of the ideas below so we can keep exploring together!`,
                sum: `Robo showed interest and invited ${name} to continue exploring.`
            };
        }

        // Sinh 4-5 Lựa chọn Mở hướng Liên tục (Branching Choices) trên màn hình
        generateBranchingChoices(userText, botText, lang) {
            const name = this.speaker.name;
            if (lang === 'vi') {
                return [
                    {
                        badge: '1. Kể thêm chi tiết',
                        text: 'Mình muốn kể rõ hơn về chuyện này...',
                        sub: 'Mở rộng câu chuyện hiện tại'
                    },
                    {
                        badge: '2. Hỏi gợi ý giải pháp',
                        text: 'Nếu là Robo thì bạn sẽ chọn phương án nào?',
                        sub: 'Nhờ bot phân tích hướng tốt nhất'
                    },
                    {
                        badge: '3. Luyện sang Tiếng Anh',
                        text: 'Câu này nói bằng tiếng Anh tự nhiên sao vậy Robo?',
                        sub: 'Chuyển sang học mẫu câu Anh–Việt'
                    },
                    {
                        badge: '4. Tình huống vui giả định',
                        text: 'Thử đặt một tình huống giả định hài hước xem sao!',
                        sub: 'Đổi không khí sáng tạo, vui vẻ'
                    },
                    {
                        badge: '5. Đổi vai trò chuyên gia',
                        text: this.role === 'DOCTOR' ? 'Cho mình gặp Quản gia sắp xếp lịch nhé' : 'Cho mình gặp Bác sĩ tư vấn sức khỏe nhé',
                        sub: 'Chuyển vai trò linh động tức thì'
                    }
                ];
            }

            return [
                {
                    badge: '1. Tell more',
                    text: 'Let me tell you more details about that!',
                    sub: 'Kể thêm chi tiết câu chuyện'
                },
                {
                    badge: '2. Ask Robo',
                    text: 'What would you choose if you were me, Robo?',
                    sub: 'Hỏi xem Robo sẽ chọn phương án nào'
                },
                {
                    badge: '3. Useful phrases',
                    text: 'Teach me useful English words for this topic!',
                    sub: 'Học từ vựng & cụm từ hay'
                },
                {
                    badge: '4. Fun What-If',
                    text: 'Let’s imagine a funny what-if game about this!',
                    sub: 'Chơi tình huống giả định vui nhộn'
                },
                {
                    badge: '5. Dịch tiếng Việt',
                    text: 'Giải thích câu vừa rồi bằng tiếng Việt giúp mình nhé!',
                    sub: 'Chuyển sang giải thích tiếng Việt'
                }
            ];
        }

        // Phát âm thanh tách chuẩn ngôn ngữ Việt - Anh
        speakBilingual(text, lang, onComplete) {
            if (!('speechSynthesis' in window)) {
                if (onComplete) setTimeout(onComplete, 900);
                return;
            }
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = (lang === 'vi') ? 'vi-VN' : 'en-US';
            utter.rate = (lang === 'vi') ? 1.02 : 0.94;
            utter.onend = () => { if (onComplete) onComplete(); };
            utter.onerror = () => { if (onComplete) onComplete(); };
            window.speechSynthesis.speak(utter);
        }

        // Quy trình xử lý 1 lượt hội thoại đầy đủ
        async processUserInput(rawInput) {
            this.clearIdleTimers();
            this.isBusy = true;

            const userText = this.cleanUserSpeech(rawInput);
            const lang = this.detectLanguage(userText);
            const switchedRole = this.detectRoleSwitch(userText);
            if (switchedRole) {
                this.role = switchedRole;
                if (this.cb.onRoleChanged) this.cb.onRoleChanged(switchedRole, PERSONA_CONFIG[switchedRole]);
            }

            const pCfg = PERSONA_CONFIG[this.role] || PERSONA_CONFIG.FRIEND;

            // Nhịp 1 (0.3s): Bật nhân vật đi qua đi lại / chống cằm suy nghĩ + Đám mây 💭••• + Câu đệm trấn an
            const thinkAnim = (this.role === 'BUTLER' || this.role === 'FRIEND') ? 'THINK_PACING' : 'THINK_CHIN';
            const fillers = (lang === 'vi') ? pCfg.fillerVi : pCfg.fillerEn;
            const fillerLine = fillers[Math.floor(Math.random() * fillers.length)];

            if (this.cb.onThinkingStart) {
                this.cb.onThinkingStart({ anim: thinkAnim, cloudText: '💭 •••', fillerLine });
            }
            this.speakBilingual(fillerLine, lang, null);

            // Nhịp 2 (6.5s): Nếu chạy model nặng 500MB - 1GB+, đổi biểu tượng đám mây & trấn an tiếp
            this.reassuranceTimer = setTimeout(() => {
                if (!this.isBusy) return;
                const secondLine = (lang === 'vi')
                    ? 'Sắp xong rồi, bạn vui lòng đợi thêm một chút xíu nữa nhé...'
                    : 'Almost ready, please hold on just a tiny bit longer...';
                if (this.cb.onThinkingStage2) {
                    this.cb.onThinkingStage2({ cloudText: '💡 •••', secondLine });
                }
                this.speakBilingual(secondLine, lang, null);
            }, 6500);

            const t0 = performance.now();
            let botReply = { full: '', sum: '' };

            const plugin = window.Capacitor?.Plugins?.LlamaPlugin;
            if (this.modelLoaded && plugin) {
                try {
                    const prompt = this.buildPromptWithSummarizedMemory(userText, lang);
                    const res = await plugin.generate({ prompt, maxTokens: 96 });
                    botReply = this.parseDualOutput(res?.text || '');
                } catch (e) {
                    console.warn('Local model generate fallback:', e);
                }
            }

            if (!botReply.full || botReply.full.length < 3) {
                // Nếu chưa nạp file .gguf trên máy, dùng bộ não phản hồi nhanh có độ trễ tự nhiên 600ms
                await new Promise((r) => setTimeout(r, 650));
                botReply = this.generateBuiltInSmartReply(userText, lang, switchedRole);
            }

            clearTimeout(this.reassuranceTimer);
            const thinkMs = Math.round(performance.now() - t0);

            // Gắn đa nhãn 1.000+ chủ đề & tạo bản ghi 2 phần (sum + full)
            const taggedRecord = global.RobotTaxonomyV24.analyzeAndTagTurn({
                userFull: userText,
                botFull: botReply.full,
                botSummaryFromModel: botReply.sum,
                role: this.role,
                speakerType: this.speaker.type,
                userLang: lang
            });

            // Lưu vào bộ nhớ trượt trên App
            this.history.push({ role: 'user', sum: taggedRecord.user.sum, full: taggedRecord.user.full, lang });
            this.history.push({ role: 'bot',  sum: taggedRecord.bot.sum,  full: taggedRecord.bot.full,  lang });
            if (this.history.length > 30) {
                this.history.splice(0, this.history.length - 30);
            }

            // Sinh 4-5 lựa chọn mở hướng liên tục
            const choices = this.generateBranchingChoices(userText, botReply.full, lang);

            this.isBusy = false;
            if (this.cb.onReplyReady) {
                this.cb.onReplyReady({
                    taggedRecord,
                    lang,
                    thinkMs,
                    anim: pCfg.anim,
                    choices
                });
            }

            // Đọc câu trả lời chính & khởi động lại bộ đếm chủ động tinh tế
            this.speakBilingual(botReply.full, lang, () => {
                this.scheduleGentleProactive();
            });

            // Bắn ngầm dữ liệu đã gắn nhãn + ký C++ HMAC về Server robot2027_2_4
            this.enqueueAndSyncToServer(taggedRecord, thinkMs);
        }

        // Gửi ngầm dữ liệu về https://khotrithucso.io.vn/robot2027_2_4/index.php
        async enqueueAndSyncToServer(taggedRecord, thinkMs) {
            const payload = {
                action: 'ingest',
                turn_id: 't_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
                bot_id: this.botId,
                android_id: this.androidId,
                speaker_name: this.speaker.name,
                speaker_type: this.speaker.type,
                active_role: this.role,
                model_name: this.loadedModelName,
                think_ms: thinkMs,
                domain: taggedRecord.domain,
                sub_topics: taggedRecord.sub_topics,
                user: taggedRecord.user,
                bot: taggedRecord.bot
            };

            this.syncQueue.push(payload);
            if (this.syncQueue.length > 100) this.syncQueue.shift();
            localStorage.setItem('r2027_sync_queue', JSON.stringify(this.syncQueue));

            await this.flushSyncQueue();
        }

        async flushSyncQueue() {
            if (this.syncQueue.length === 0) return;
            const plugin = window.Capacitor?.Plugins?.LlamaPlugin;

            while (this.syncQueue.length > 0) {
                const item = this.syncQueue[0];
                const ts = Math.floor(Date.now() / 1000).toString();
                const nonce = 'nc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

                let signature = '';
                if (plugin && plugin.signPayload) {
                    try {
                        const signed = await plugin.signPayload({
                            botId: item.bot_id,
                            androidId: item.android_id,
                            timestamp: ts,
                            nonce: nonce,
                            userFull: item.user.full,
                            botFull: item.bot.full
                        });
                        signature = signed?.signature || '';
                    } catch (e) {
                        console.warn('signPayload error:', e);
                    }
                }

                const packet = { ...item, timestamp: ts, nonce, signature };

                try {
                    const res = await fetch(this.serverUrl + '?action=ingest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(packet)
                    });
                    if (res.ok) {
                        this.syncQueue.shift();
                        localStorage.setItem('r2027_sync_queue', JSON.stringify(this.syncQueue));
                        if (this.cb.onSyncStatus) this.cb.onSyncStatus(true, this.syncQueue.length);
                    } else {
                        if (this.cb.onSyncStatus) this.cb.onSyncStatus(false, this.syncQueue.length);
                        break;
                    }
                } catch (err) {
                    if (this.cb.onSyncStatus) this.cb.onSyncStatus(false, this.syncQueue.length);
                    break;
                }
            }
        }

        clearIdleTimers() {
            if (this.proactiveTimer) clearTimeout(this.proactiveTimer);
            if (this.sleepTimer) clearTimeout(this.sleepTimer);
            this.proactiveTimer = null;
            this.sleepTimer = null;
        }

        // Chủ động hỏi thăm tinh tế khi người dùng im lặng lâu (không dồn dập)
        scheduleGentleProactive() {
            this.clearIdleTimers();
            if (!this.proactiveEnabled || this.isBusy) return;

            // Sau 35 giây im lặng -> Hỏi thăm nhẹ nhàng + gợi ý nếu người dùng đang bí lời
            this.proactiveTimer = setTimeout(() => {
                if (!this.proactiveEnabled || this.isBusy) return;
                const name = this.speaker.name;
                const prompts = [
                    {
                        text: `Hi ${name}, bạn đang bận hả hay đang suy nghĩ câu trả lời thế? Nếu bí lời thì bấm thử một trong các lựa chọn gợi ý trên màn hình nha!`,
                        lang: 'vi'
                    },
                    {
                        text: `${name} ơi, nếu được chọn một phương án cho câu chuyện vừa rồi thì bạn nghiêng về hướng nào? Mình luôn ở đây nghe bạn nè!`,
                        lang: 'vi'
                    },
                    {
                        text: `Hey ${name}, are you thinking of what to say next? Tap any suggestion pill below whenever you are ready!`,
                        lang: 'en'
                    }
                ];
                const pick = prompts[Math.floor(Math.random() * prompts.length)];
                if (this.cb.onProactiveNudge) {
                    this.cb.onProactiveNudge(pick);
                }
                this.speakBilingual(pick.text, pick.lang, null);
            }, 35000);

            // Sau 95 giây im lặng -> Chuyển nhân vật sang dáng ngủ tiết kiệm pin
            this.sleepTimer = setTimeout(() => {
                if (!this.proactiveEnabled || this.isBusy) return;
                if (this.cb.onSleepEnter) this.cb.onSleepEnter();
            }, 95000);
        }
    }

    global.RobotV24AppEngine = RobotV24AppEngine;
    global.ROBOT_PERSONAS_V24 = PERSONA_CONFIG;
})(window);
