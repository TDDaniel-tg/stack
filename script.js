// DOM Elements
const apiKeyInput = document.getElementById('apiKey');
const ticketNumberInput = document.getElementById('ticketNumber');
const question1Input = document.getElementById('question1');
const question2Input = document.getElementById('question2');
const question3Input = document.getElementById('question3');
const generateBtn = document.getElementById('generateBtn');
const outputContent = document.getElementById('outputContent');
const outputActions = document.getElementById('outputActions');
const copyBtn = document.getElementById('copyBtn');
const toast = document.getElementById('toast');
const uploadZone = document.getElementById('uploadZone');
const uploadPlaceholder = document.getElementById('uploadPlaceholder');
const uploadPreview = document.getElementById('uploadPreview');
const previewImage = document.getElementById('previewImage');
const extractBtn = document.getElementById('extractBtn');
const imageInput = document.getElementById('imageInput');

// Store uploaded image data
let uploadedImageBase64 = null;

// Load saved API key from localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedApiKey = localStorage.getItem('gemini_api_key');
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // Setup drag and drop
    setupDragAndDrop();
});

// Save API key to localStorage when changed
apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value);
});

// Setup drag and drop for image upload
function setupDragAndDrop() {
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            handleImage(files[0]);
        }
    });
}

// Handle image upload
function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
        handleImage(file);
    }
}

// Process uploaded image
function handleImage(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
        const base64 = e.target.result;
        uploadedImageBase64 = base64.split(',')[1]; // Remove data URL prefix

        // Show preview
        previewImage.src = base64;
        uploadPlaceholder.style.display = 'none';
        uploadPreview.style.display = 'flex';
        extractBtn.style.display = 'flex';

        showToast('Фото загружено! Нажмите "Извлечь вопросы" 📷');
    };

    reader.readAsDataURL(file);
}

// Remove uploaded image
function removeImage(event) {
    event.stopPropagation();

    uploadedImageBase64 = null;
    imageInput.value = '';
    previewImage.src = '';
    uploadPlaceholder.style.display = 'flex';
    uploadPreview.style.display = 'none';
    extractBtn.style.display = 'none';
}

// Extract questions from image using Gemini Vision
async function extractFromImage() {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
        showToast('Введите API ключ Gemini', true);
        apiKeyInput.focus();
        return;
    }

    if (!uploadedImageBase64) {
        showToast('Сначала загрузите фото билета', true);
        return;
    }

    // Show loading state
    extractBtn.classList.add('loading');
    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="btn-icon">⚡</span> Извлекаю...';

    const extractPrompt = `Посмотри на это фото экзаменационного билета и извлеки из него информацию.

Верни ответ СТРОГО в формате JSON:
{
    "ticketNumber": <номер билета как число>,
    "question1": "<текст первого вопроса>",
    "question2": "<текст второго вопроса>",
    "question3": "<текст третьего вопроса>"
}

ВАЖНО:
- Извлеки ТОЛЬКО текст на русском языке (если есть текст на других языках - игнорируй его)
- Номер билета - это число после слова "билет" или "№"
- Вопросы могут быть пронумерованы как 1, 2, 3 или I, II, III
- Верни ТОЛЬКО JSON без дополнительного текста`;

    try {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: extractPrompt },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: uploadedImageBase64
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP Error: ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            let resultText = data.candidates[0].content.parts[0].text;

            // Clean up the response - remove markdown code blocks if present
            resultText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            // Parse JSON
            const extracted = JSON.parse(resultText);

            // Fill in the form
            if (extracted.ticketNumber) {
                ticketNumberInput.value = extracted.ticketNumber;
            }
            if (extracted.question1) {
                question1Input.value = extracted.question1;
            }
            if (extracted.question2) {
                question2Input.value = extracted.question2;
            }
            if (extracted.question3) {
                question3Input.value = extracted.question3;
            }

            showToast('Вопросы извлечены из фото! ✨');
        } else {
            throw new Error('Неожиданный формат ответа от API');
        }

    } catch (error) {
        console.error('Error:', error);
        showToast('Ошибка при извлечении: ' + error.message, true);
    } finally {
        // Reset button state
        extractBtn.classList.remove('loading');
        extractBtn.disabled = false;
        extractBtn.innerHTML = '<span class="btn-icon">🔍</span> Извлечь вопросы из фото';
    }
}

// Toggle API key visibility
function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const btn = document.querySelector('.toggle-visibility');
    if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = '🙈';
    } else {
        input.type = 'password';
        btn.textContent = '👁️';
    }
}

// Show toast notification
function showToast(message, isError = false) {
    toast.textContent = message;
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Clean markdown formatting from text
function cleanMarkdown(text) {
    return text
        // Remove bold markers ** and __
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // Remove italic markers * and _
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove headers # ## ### etc
        .replace(/^#{1,6}\s*/gm, '')
        // Remove code blocks ```
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code `
        .replace(/`([^`]+)`/g, '$1')
        // Remove bullet points - and * at line start
        .replace(/^[\s]*[-*]\s+/gm, '• ')
        // Clean up extra spaces
        .replace(/\s{3,}/g, '  ');
}

// Store the plain text result for downloads
let currentResultText = '';

// Generate answers using Gemini API
async function generateAnswers() {
    const apiKey = apiKeyInput.value.trim();
    const ticketNumber = ticketNumberInput.value.trim();
    const question1 = question1Input.value.trim();
    const question2 = question2Input.value.trim();
    const question3 = question3Input.value.trim();

    // Validation
    if (!apiKey) {
        showToast('Введите API ключ Gemini', true);
        apiKeyInput.focus();
        return;
    }

    if (!ticketNumber) {
        showToast('Введите номер билета', true);
        ticketNumberInput.focus();
        return;
    }

    if (!question1 || !question2 || !question3) {
        showToast('Заполните все три вопроса', true);
        return;
    }

    // Show loading state
    generateBtn.classList.add('loading');
    generateBtn.disabled = true;
    generateBtn.innerHTML = '<span class="btn-icon">⚡</span> Генерация...';

    outputContent.innerHTML = `
        <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <p class="loading-text">AI анализирует вопросы и готовит ответы...</p>
        </div>
    `;
    outputActions.style.display = 'none';

    // Build the prompt
    const prompt = `Ты — квалифицированный преподаватель в Кыргызстане. Ответь на 3 вопроса экзаменационного билета.

ПРАВИЛА:
1. Используй законодательство КЫРГЫЗСКОЙ РЕСПУБЛИКИ (ГК КР, УК КР, ТК КР, Конституция КР и т.д.)
2. Отвечай КРАТКО, структурированно, по существу
3. Адаптируй формат ответа под тип вопроса (теория, практика, задача)
4. Отвечай на любые предметы: право, экономика, медицина, IT, история и др.

СТРУКТУРА ОТВЕТА на каждый вопрос:
• Определение/суть (1-2 предложения)
• Основные положения/виды/этапы (списком)
• Правовая основа в КР (если применимо)
• Вывод (1 предложение)

Если вопрос — ЗАДАЧА или СИТУАЦИЯ:
• Дано
• Анализ
• Решение
• Ответ

БИЛЕТ ${ticketNumber}

Вопрос 1: ${question1}
Вопрос 2: ${question2}
Вопрос 3: ${question3}

Дай структурированные ответы на русском языке. Используй нумерацию и списки для читаемости.`;

    // Models to try - from primary to fallbacks (all confirmed to exist in docs)
    const models = [
        'gemini-2.5-flash',      // Primary - newest
        'gemini-2.5-flash-lite', // Fallback 1 - fastest, high throughput
        'gemini-2.0-flash'       // Fallback 2 - stable second gen
    ];
    let lastError = null;

    for (const model of models) {
        try {
            outputContent.innerHTML = `
                <div class="loading-indicator">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">Генерация (${model})...</p>
                </div>
            `;
            console.log(`Trying model: ${model}`);

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.error?.message || `HTTP Error: ${response.status}`;
                console.log(`Model ${model} failed: ${errorMsg}`);

                // If overloaded or rate limited, try next model
                if (errorMsg.includes('overloaded') || errorMsg.includes('quota') ||
                    errorMsg.includes('not found') || response.status === 503 ||
                    response.status === 429 || response.status === 404) {
                    lastError = new Error(errorMsg);
                    continue; // Try next model
                }
                throw new Error(errorMsg);
            }

            const data = await response.json();

            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const resultText = data.candidates[0].content.parts[0].text;
                currentResultText = cleanMarkdown(resultText); // Store cleaned text for downloads

                // Display result
                outputContent.innerHTML = `<div class="result-text">${formatResult(resultText)}</div>`;
                outputActions.style.display = 'flex';

                showToast(`Ответы сгенерированы (${model})! ✨`);

                // Reset button and return on success
                generateBtn.classList.remove('loading');
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<span class="btn-icon">✨</span> Сгенерировать ответы';
                return;
            } else {
                throw new Error('Неожиданный формат ответа от API');
            }

        } catch (error) {
            console.error(`Model ${model} error:`, error);
            lastError = error;

            // If overloaded, continue to next model
            if (error.message.includes('overloaded') || error.message.includes('quota') ||
                error.message.includes('not found') || error.message.includes('503') ||
                error.message.includes('429') || error.message.includes('404')) {
                continue;
            }
            // For other errors, stop trying
            break;
        }
    }

    // All models failed
    outputContent.innerHTML = `
        <div class="error-message">
            <span>⚠️</span>
            <span>Ошибка: ${lastError?.message || 'Все модели перегружены. Попробуйте через минуту.'}</span>
        </div>
    `;
    showToast('Ошибка при генерации', true);

    // Reset button state
    generateBtn.classList.remove('loading');
    generateBtn.disabled = false;
    generateBtn.innerHTML = '<span class="btn-icon">✨</span> Сгенерировать ответы';
}

// Format the result text with basic styling
function formatResult(text) {
    // Clean up markdown formatting first
    let cleaned = text
        // Remove bold markers ** and __
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // Remove italic markers * and _
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove headers # ## ### etc
        .replace(/^#{1,6}\s*/gm, '')
        // Remove code blocks ```
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code `
        .replace(/`([^`]+)`/g, '$1')
        // Remove bullet points - and *
        .replace(/^[\s]*[-*]\s+/gm, '• ')
        // Remove numbered lists formatting like "1. " at start (but keep our question numbers)
        // Clean up extra spaces
        .replace(/\s{3,}/g, '  ');

    // Escape HTML
    let formatted = cleaned
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Add some basic formatting
    formatted = formatted
        // Bold for БИЛЕТ header
        .replace(/^(БИЛЕТ\s*\d+)/gm, '<strong style="color: #818cf8; font-size: 1.3em;">$1</strong>')
        // Bold for section headers
        .replace(/^(ШАГ \d+\..*?)$/gm, '<strong style="color: #f472b6;">$1</strong>')
        .replace(/^(РЕШЕНИЕ.*?)$/gm, '<strong style="color: #10b981;">$1</strong>')
        .replace(/^(ИТОГ:?)$/gm, '<strong style="color: #10b981;">$1</strong>')
        .replace(/^(ВАРИАНТ \d+.*?)$/gm, '<strong style="color: #fbbf24;">$1</strong>')
        .replace(/^(Дано:)$/gm, '<strong style="color: #06b6d4;">$1</strong>')
        .replace(/^(Вывод:)(.*)$/gm, '<strong style="color: #10b981;">$1</strong>$2')
        // Format question numbers
        .replace(/^(\d+\.)/gm, '<strong style="color: #818cf8;">$1</strong>');

    return formatted;
}

// Copy result to clipboard
async function copyResult() {
    if (!currentResultText) return;

    try {
        await navigator.clipboard.writeText(currentResultText);
        showToast('Скопировано в буфер обмена! 📋');

        // Animate copy button
        copyBtn.innerHTML = '<span>✅</span> Скопировано!';
        setTimeout(() => {
            copyBtn.innerHTML = '<span>📋</span> Копировать';
        }, 2000);
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = currentResultText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Скопировано в буфер обмена! 📋');
    }
}

// Download as TXT
function downloadTxt() {
    if (!currentResultText) return;

    const ticketNumber = ticketNumberInput.value.trim() || 'bilet';
    const blob = new Blob([currentResultText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `Билет_${ticketNumber}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Файл TXT скачан! 📄');
}

// Download as DOCX
async function downloadDocx() {
    if (!currentResultText) return;

    const ticketNumber = ticketNumberInput.value.trim() || 'bilet';

    try {
        // Use the docx library
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;

        // Parse the text into paragraphs
        const lines = currentResultText.split('\n');
        const children = [];

        for (const line of lines) {
            if (line.trim() === '') {
                children.push(new Paragraph({}));
                continue;
            }

            // Check if it's a БИЛЕТ header
            if (line.match(/^БИЛЕТ\s*\d+/)) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, bold: true, size: 32 })],
                    heading: HeadingLevel.HEADING_1,
                    spacing: { after: 200 }
                }));
            }
            // Check if it's a question number (1. 2. 3.)
            else if (line.match(/^\d+\./)) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, bold: true, size: 26 })],
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 100 }
                }));
            }
            // Check if it's a section header (ШАГ, РЕШЕНИЕ, ИТОГ, etc.)
            else if (line.match(/^(ШАГ \d+|РЕШЕНИЕ|ИТОГ|ВАРИАНТ \d+|Дано:|Вывод:)/)) {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, bold: true, size: 24 })],
                    spacing: { before: 100, after: 50 }
                }));
            }
            // Regular text
            else {
                children.push(new Paragraph({
                    children: [new TextRun({ text: line, size: 24 })],
                    spacing: { after: 50 }
                }));
            }
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `Билет_${ticketNumber}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Файл DOCX скачан! 📝');
    } catch (error) {
        console.error('DOCX error:', error);
        showToast('Ошибка создания DOCX: ' + error.message, true);
    }
}

// Allow Enter key to trigger generation (with Ctrl/Cmd)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        generateAnswers();
    }
});
