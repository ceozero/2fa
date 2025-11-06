// 常量定义
const TIME_STEP = 30; // TOTP时间步长（秒）
const OTP_LENGTH = 6; // OTP长度
const MAX_RETRY_COUNT = 3; // 最大重试次数

// 添加事件监听器
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 处理请求的主要函数
async function handleRequest(request) {
  try {
    const url = new URL(request.url);

    // 从路径中提取密钥并进行URL解码和清理
    const decodedPath = decodeURIComponent(url.pathname.substring(1));
    const secret = decodedPath.replace(/\s+/g, '');

    // 检查是否请求JSON格式
    const format = url.searchParams.get('format');
    
    // JSON格式请求处理
    if (format === 'json') {
      return handleJsonRequest(secret, url.origin);
    }

    // HTML页面请求处理
    return handleHtmlRequest(secret);
  } catch (error) {
    return new Response(`Error: ${error.message}\n\nPlease check your secret key format. It should be Base32 encoded (A-Z, 2-7).`, {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

// 处理JSON格式请求
async function handleJsonRequest(secret, origin) {
  if (!secret) {
    return new Response(JSON.stringify({
      error: 'Missing secret parameter',
      usage: `${origin}/YOUR_SECRET_KEY?format=json`,
      example: `${origin}/JBSWY3DPEHPK3PXP?format=json`
    }, null, 2), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  try {
    const otp = await generateOTP(secret);
    const remaining = calculateRemainingTime();
    const serverTime = Math.floor(Date.now() / 1000);
    
    return new Response(JSON.stringify({
      token: otp,
      remaining: remaining,
      serverTime: serverTime
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Invalid secret key format',
      message: error.message
    }, null, 2), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// 处理HTML页面请求
async function handleHtmlRequest(secret) {
  // 如果有密钥，尝试验证其有效性
  let initialOtp = '';
  let remainingTime = 0;
  let serverTime = 0;
  let hasValidSecret = false;
  
  if (secret) {
    try {
      initialOtp = await generateOTP(secret);
      remainingTime = calculateRemainingTime();
      serverTime = Math.floor(Date.now() / 1000);
      hasValidSecret = true;
    } catch (error) {
      // 密钥无效，但继续显示页面让用户看到错误
      console.error('Invalid secret:', error.message);
    }
  }

  const htmlContent = generateHtmlTemplate(secret, initialOtp, remainingTime, serverTime, hasValidSecret);

  return new Response(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
}

// 生成HTML模板
function generateHtmlTemplate(secret, initialOtp, remainingTime, serverTime, hasValidSecret) {
  const escapedSecret = (secret || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="description" content="TOTP验证码生成器 - 支持Google Authenticator、Microsoft Authenticator等双因素认证应用的验证码生成">
    <meta name="robots" content="noindex, nofollow">
    <title>TOTP/2FA验证码生成器 - 双因素认证工具</title>
    ${getStyles()}
  </head>
  <body>
    <div class="page-header">
      <h1 class="page-title">TOTP验证码生成器</h1>
      <p class="page-subtitle">支持Google Authenticator、Microsoft Authenticator等双因素认证应用</p>
    </div>
    <div class="totp">
      <div class="card">
        <div class="press">
          <span id="press-bar"></span>
        </div>
        <div class="card-content">
          <div class="input-group">
            <input 
              type="text" 
              class="secret-input" 
              id="secret-input" 
              placeholder="请输入Base32格式的密钥" 
              value="${escapedSecret}"
              autocomplete="off">
            <button class="get-btn" id="get-btn">获取</button>
          </div>
          <div class="error-message" id="error-message" style="display: none;"></div>
          <div class="code" id="code-container" style="display: none;">
            <span id="token" title="点击复制"></span>
          </div>
          <div class="seconds" id="seconds-container" style="display: none;">
            <span>剩余 <b id="seconds">0</b> 秒</span>
          </div>
          <div class="copied-message" id="copied">已复制!</div>
        </div>
      </div>
    </div>
    <div class="url-tip">
      <div class="tip-content">
        <div class="tip-title">快速使用方式</div>
        <div>您可以通过URL参数直接传入密钥，无需手动输入：</div>
        <div class="url-example">
          <span id="example-url"></span>
          <button class="copy-btn" id="copy-url">复制</button>
        </div>
        <div>您可以通过URL参数JSON格式直接传入密钥，获取JSON格式：</div>
        <div class="url-example">
          <span id="example-json-url"></span>
          <button class="copy-btn" id="copy-json-url">复制</button>
        </div>
        <div style="margin-top: 8px; font-size: 12px; color: #64748b">将 YOUR_SECRET_KEY 替换为您的实际密钥即可</div>
      </div>
    </div>
    <script>
      ${getClientScript(secret, initialOtp, remainingTime, serverTime, hasValidSecret)}
    </script>
  </body>
</html>`;
}

// 提取CSS样式
function getStyles() {
  return `<style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell",
        "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
      background-color: #f5f5f5;
      min-height: 100vh;
    }
    .page-header { text-align: center; padding: 20px 0; }
    .page-title {
      font-size: 28px;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 8px 0;
      letter-spacing: -0.5px;
    }
    .page-subtitle {
      font-size: 14px;
      color: #6b7280;
      margin: 0;
      font-weight: 400;
    }
    .totp {
      width: 520px;
      max-width: 100%;
      margin: 30px auto 0;
    }
    .totp .card { position: relative; }
    .totp .press {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 5px;
      z-index: 10;
    }
    .totp .press span {
      position: absolute;
      left: 0;
      bottom: 0;
      background: #006eff;
      display: inline-block;
      height: 5px;
      width: 50%;
      transition: all 0.3s;
      border-radius: 0 0 4px 4px;
    }
    .card-content {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .input-group {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .secret-input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid #dcdfe6;
      border-radius: 4px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.3s;
    }
    .secret-input:focus { border-color: #006eff; }
    .secret-input.is-error { border-color: #f56c6c; }
    .get-btn {
      padding: 10px 20px;
      background: #006eff;
      color: #fff;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.3s;
    }
    .get-btn:hover { background: #0052cc; }
    .get-btn:active { background: #003d99; }
    .get-btn:disabled {
      background: #a0aec0;
      cursor: not-allowed;
    }
    .error-message {
      color: #f56c6c;
      font-size: 12px;
      margin-top: 5px;
      margin-bottom: 10px;
    }
    .totp .code {
      text-align: center;
      padding: 20px 0;
    }
    .totp .code span {
      display: inline-block;
      font-size: 26px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 5px 10px;
      border-radius: 4px;
      background-color: #fff;
      letter-spacing: 2px;
      cursor: pointer;
      transition: transform 0.1s;
    }
    .totp .code span:hover { transform: scale(1.05); }
    .totp .code span:active { transform: scale(0.95); }
    .totp .seconds {
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .totp .seconds b {
      font-size: 20px;
      color: #006eff;
    }
    .copied-message {
      font-size: 12px;
      color: #67c23a;
      text-align: center;
      margin-top: 10px;
      opacity: 0;
      transition: opacity 0.3s;
      height: 20px;
    }
    .copied-message.show { opacity: 1; }
    .url-tip {
      width: 520px;
      max-width: 100%;
      margin: 20px auto 0;
    }
    .url-tip .tip-content {
      background: #f0f9ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 12px;
      font-size: 13px;
      color: #1e40af;
    }
    .url-tip .tip-title {
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
    }
    .url-tip .tip-title::before {
      content: "💡";
      margin-right: 6px;
    }
    .url-example {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: #475569;
      word-break: break-all;
    }
    .copy-btn {
      margin-left: 8px;
      font-size: 12px;
      padding: 2px 8px;
      cursor: pointer;
      color: #006eff;
      background: transparent;
      border: none;
    }
    @media (max-width: 600px) {
      .totp, .url-tip { width: 100%; margin-top: 20px; }
      .totp .code span {
        font-size: 22px;
        padding: 8px 12px;
      }
      .input-group { flex-direction: column; }
      .get-btn { width: 100%; }
      .page-title { font-size: 24px; }
      .page-subtitle {
        font-size: 13px;
        padding: 0 20px;
      }
    }
  </style>`;
}

// 提取客户端脚本
function getClientScript(secret, initialOtp, remainingTime, serverTime, hasValidSecret) {
  return `
    (function() {
      const TIME_STEP = ${TIME_STEP};
      const MAX_RETRY = ${MAX_RETRY_COUNT};
      
      // DOM 元素缓存
      const els = {
        secretInput: document.getElementById('secret-input'),
        getBtn: document.getElementById('get-btn'),
        token: document.getElementById('token'),
        codeContainer: document.getElementById('code-container'),
        secondsContainer: document.getElementById('seconds-container'),
        seconds: document.getElementById('seconds'),
        copied: document.getElementById('copied'),
        errorMessage: document.getElementById('error-message'),
        pressBar: document.getElementById('press-bar')
      };

      // 状态管理
      let state = {
        currentSecret: ${JSON.stringify(secret || '')},
        intervalId: null,
        remaining: 0,
        retryCount: 0,
        isRefreshing: false,
        serverTimeOffset: 0 // 服务器时间与客户端时间的偏移量
      };

      // 计算服务器时间偏移（仅用于补偿网络延迟）
      function calculateServerOffset(serverTime) {
        const clientTime = Math.floor(Date.now() / 1000);
        state.serverTimeOffset = serverTime - clientTime;
      }

      // 根据服务器时间偏移计算当前剩余时间
      function getAdjustedRemaining(serverRemaining, serverTime) {
        const clientTime = Math.floor(Date.now() / 1000);
        const elapsedSinceServer = clientTime - serverTime;
        const adjusted = serverRemaining - elapsedSinceServer;
        return adjusted > 0 ? adjusted : 0;
      }

      // 初始化：如果有有效密钥，显示验证码
      ${hasValidSecret && initialOtp ? `
        calculateServerOffset(${serverTime});
        els.token.textContent = ${JSON.stringify(initialOtp)};
        els.codeContainer.style.display = 'block';
        els.secondsContainer.style.display = 'block';
        state.remaining = getAdjustedRemaining(${remainingTime}, ${serverTime});
        startTimer();
      ` : secret && !hasValidSecret ? `
        showError('密钥格式错误，请检查Base32格式');
      ` : ''}

      // 获取按钮点击事件
      els.getBtn.addEventListener('click', () => {
        const secret = els.secretInput.value.trim();
        if (!secret) {
          showError('请输入密钥');
          return;
        }
        state.currentSecret = secret;
        state.retryCount = 0;
        updateUrl(secret);
        initTotp(secret);
      });

      // 输入框回车事件
      els.secretInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          els.getBtn.click();
        }
      });

      // 初始化TOTP
      function initTotp(secret) {
        hideError();
        const newPath = '/' + encodeURIComponent(secret);
        
        if (window.location.pathname !== newPath) {
          history.pushState({ secret }, '', newPath);
        }

        setLoading(true);

        fetch(newPath + '?format=json')
          .then(response => {
            if (!response.ok) {
              return response.json().then(data => {
                throw new Error(data.error || '生成失败');
              });
            }
            return response.json();
          })
          .then(data => {
            calculateServerOffset(data.serverTime);
            els.token.textContent = data.token;
            els.codeContainer.style.display = 'block';
            els.secondsContainer.style.display = 'block';
            state.remaining = getAdjustedRemaining(data.remaining, data.serverTime);
            state.retryCount = 0;
            startTimer();
            setLoading(false);
          })
          .catch(error => {
            showError(error.message || '密钥格式错误，请检查Base32格式');
            setLoading(false);
          });
      }

      // 刷新验证码
      function refreshTotp() {
        if (!state.currentSecret || state.isRefreshing) return;
        
        if (state.retryCount >= MAX_RETRY) {
          showError('自动刷新失败次数过多，请手动重新获取');
          clearInterval(state.intervalId);
          state.intervalId = null;
          return;
        }
        
        state.isRefreshing = true;
        state.retryCount++;
        
        const path = '/' + encodeURIComponent(state.currentSecret);
        
        fetch(path + '?format=json')
          .then(response => {
            if (!response.ok) throw new Error('刷新失败');
            return response.json();
          })
          .then(data => {
            calculateServerOffset(data.serverTime);
            els.token.textContent = data.token;
            state.remaining = getAdjustedRemaining(data.remaining, data.serverTime);
            state.retryCount = 0;
            state.isRefreshing = false;
            startTimer();
          })
          .catch(() => {
            state.isRefreshing = false;
            console.error('自动刷新验证码失败，重试次数:', state.retryCount);
          });
      }

      // 开始计时器
      function startTimer() {
        if (state.intervalId) {
          clearInterval(state.intervalId);
        }
        
        updateProgress();
        
        state.intervalId = setInterval(() => {
          state.remaining--;
          
          if (state.remaining <= 0) {
            clearInterval(state.intervalId);
            els.token.textContent = '...';
            state.remaining = 0;
            updateProgress();
            refreshTotp();
          } else {
            updateProgress();
          }
        }, 1000);
      }

      // 更新进度条
      function updateProgress() {
        const percentage = Math.min((state.remaining / TIME_STEP) * 100, 100);
        els.pressBar.style.width = percentage + '%';
        els.seconds.textContent = state.remaining;
      }

      // 点击复制
      els.token.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(els.token.textContent);
          showCopied();
        } catch (err) {
          // 降级方案
          try {
            const ta = document.createElement('textarea');
            ta.value = els.token.textContent;
            ta.style.position = 'fixed';
            ta.style.left = '-999999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showCopied();
          } catch (e) {
            console.error('复制失败:', e);
          }
        }
      });

      // 显示复制成功提示
      function showCopied() {
        els.copied.classList.add('show');
        setTimeout(() => els.copied.classList.remove('show'), 2000);
      }

      // 设置加载状态
      function setLoading(loading) {
        els.getBtn.disabled = loading;
        els.getBtn.textContent = loading ? '生成中...' : '获取';
        if (loading) {
          els.codeContainer.style.display = 'none';
          els.secondsContainer.style.display = 'none';
        }
      }

      // 显示错误
      function showError(message) {
        els.errorMessage.textContent = message;
        els.errorMessage.style.display = 'block';
        els.secretInput.classList.add('is-error');
      }

      // 隐藏错误
      function hideError() {
        els.errorMessage.style.display = 'none';
        els.secretInput.classList.remove('is-error');
      }

      // 更新URL
      function updateUrl(secret) {
        const newPath = '/' + encodeURIComponent(secret);
        history.pushState({ secret }, '', newPath);
      }

      // 处理浏览器前进后退
      window.addEventListener('popstate', (e) => {
        if (e.state?.secret) {
          els.secretInput.value = e.state.secret;
          state.currentSecret = e.state.secret;
          state.retryCount = 0;
          initTotp(e.state.secret);
        }
      });

      // 初始化URL提示
      (function() {
        const origin = window.location.origin;
        const example = origin + '/YOUR_SECRET_KEY';
        const exampleJson = example + '?format=json';

        document.getElementById('example-url').textContent = example;
        document.getElementById('example-json-url').textContent = exampleJson;

        function copyText(text) {
          return navigator.clipboard.writeText(text).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-999999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          });
        }

        document.getElementById('copy-url').addEventListener('click', () => {
          copyText(example).then(showCopied).catch(() => alert('复制失败，请手动复制'));
        });

        document.getElementById('copy-json-url').addEventListener('click', () => {
          copyText(exampleJson).then(showCopied).catch(() => alert('复制失败，请手动复制'));
        });
      })();
    })();
  `;
}

// 生成 OTP 的函数
async function generateOTP(secret) {
  const epochTime = Math.floor(Date.now() / 1000);
  let counter = Math.floor(epochTime / TIME_STEP);

  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter >>>= 8;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    base32toByteArray(secret),
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const hmacBuffer = await crypto.subtle.sign('HMAC', key, counterBytes.buffer);
  const hmacArray = Array.from(new Uint8Array(hmacBuffer));

  const offset = hmacArray[hmacArray.length - 1] & 0xf;
  const truncatedHash = hmacArray.slice(offset, offset + 4);
  const otpValue = new DataView(new Uint8Array(truncatedHash).buffer).getUint32(0) & 0x7fffffff;
  const otp = (otpValue % Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0');

  return otp;
}

// 辅助函数：将 Base32 编码的密钥转换为字节数组
function base32toByteArray(base32) {
  const charTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedBase32 = base32.toUpperCase().replace(/=+$/, '');
  const base32Chars = cleanedBase32.split('');

  // 验证所有字符
  for (const char of base32Chars) {
    if (charTable.indexOf(char) === -1) {
      throw new Error(`Invalid Base32 character: '${char}'. Only A-Z and 2-7 are allowed.`);
    }
  }

  const bits = base32Chars.map(char => charTable.indexOf(char).toString(2).padStart(5, '0')).join('');

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}

// 辅助函数：计算 OTP 剩余有效时间
function calculateRemainingTime() {
  const epochTime = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(epochTime / TIME_STEP);
  const expirationTime = (currentCounter + 1) * TIME_STEP;
  const remainingTime = expirationTime - epochTime;
  return remainingTime;
}