// 常量定义
const TIME_STEP = 30; // TOTP时间步长（秒）
const OTP_LENGTH = 6; // OTP长度

// 添加事件监听器
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

// 处理请求的主要函数
async function handleRequest(request) {
  try {
    // 使用 new URL(request.url) 创建 URL 对象
    const url = new URL(request.url);

    // 从路径中提取密钥
    // 从路径中提取密钥并进行URL解码
    const decodedPath = decodeURIComponent(url.pathname.substring(1));
    // 移除所有空白字符
    const secret = decodedPath.replace(/\s+/g, '');

    // 检查是否请求JSON格式
    const format = url.searchParams.get('format');
    
    // 如果请求JSON格式但没有密钥，返回错误
    if (format === 'json' && !secret) {
      const currentOrigin = url.origin;
      return new Response(JSON.stringify({
        error: 'Missing secret parameter',
        usage: `${currentOrigin}/YOUR_SECRET_KEY?format=json`,
        example: `${currentOrigin}/JBSWY3DPEHPK3PXP?format=json`
      }, null, 2), {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 如果有密钥，生成 OTP 和计算剩余时间
    let otp = '';
    let remainingTime = TIME_STEP;
    if (secret) {
      try {
        otp = await generateOTP(secret);
        remainingTime = calculateRemainingTime();
      } catch (error) {
        // 如果生成OTP失败，继续显示页面（前端会处理错误）
        otp = '';
        remainingTime = TIME_STEP;
      }
    }

    // 如果请求JSON格式且有密钥，返回JSON
    if (format === 'json') {
      if (!otp) {
        return new Response(JSON.stringify({
          error: 'Invalid secret key format'
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
      return new Response(JSON.stringify({
        token: otp
      }, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 构建 HTML 页面
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="description" content="TOTP验证码生成器 - 支持Google Authenticator、Microsoft Authenticator等双因素认证应用的验证码生成">
        <meta name="robots" content="noindex, nofollow">
        <title>TOTP/2FA验证码生成器 - 双因素认证工具</title>
        <style>
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell",
              "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
            background-color: #f5f5f5;
            min-height: 100vh;
          }
          .page-header {
            text-align: center;
            padding: 20px 0;
          }
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
            margin: 0 auto;
            margin-top: 30px;
          }
          .totp .card {
            position: relative;
          }
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
          .secret-input:focus {
            border-color: #006eff;
          }
          .secret-input.is-error {
            border-color: #f56c6c;
          }
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
          .get-btn:hover {
            background: #0052cc;
          }
          .get-btn:active {
            background: #003d99;
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
          .totp .code span:hover {
            transform: scale(1.05);
          }
          .totp .code span:active {
            transform: scale(0.95);
          }
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
          .copied-message.show {
            opacity: 1;
          }
          @media (max-width: 600px) {
            .totp {
              width: 100%;
              margin-top: 20px;
            }
            .totp .code span {
              font-size: 22px;
              padding: 8px 12px;
            }
            .input-group {
              flex-direction: column;
            }
            .get-btn {
              width: 100%;
            }
            .page-title {
              font-size: 24px;
            }
            .page-subtitle {
              font-size: 13px;
              padding: 0 20px;
            }
          }
        </style>
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
                  value="${(secret || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;')}"
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
        <script>
          const secretInput = document.getElementById('secret-input');
          const getBtn = document.getElementById('get-btn');
          const tokenEl = document.getElementById('token');
          const codeContainer = document.getElementById('code-container');
          const secondsContainer = document.getElementById('seconds-container');
          const secondsEl = document.getElementById('seconds');
          const copiedEl = document.getElementById('copied');
          const errorMessage = document.getElementById('error-message');
          const pressBar = document.getElementById('press-bar');
          const totalTime = ${TIME_STEP};
          let remaining = ${remainingTime};
          let currentSecret = ${JSON.stringify(secret || '')};
          let intervalId = null;

          // 初始化：如果服务器端已经生成了 OTP，直接显示
          ${(secret && otp) ? `
            tokenEl.textContent = ${JSON.stringify(otp)};
            codeContainer.style.display = 'block';
            secondsContainer.style.display = 'block';
            startTimer();
          ` : secret ? `
            // 如果只有密钥但生成失败，尝试重新生成
            initTotp(${JSON.stringify(secret)});
          ` : ''}

          // 获取按钮点击事件
          getBtn.addEventListener('click', () => {
            const secret = secretInput.value.trim();
            if (!secret) {
              showError('请输入密钥');
              return;
            }
            currentSecret = secret;
            updateUrl(secret);
            initTotp(secret);
          });

          // 输入框回车事件
          secretInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              getBtn.click();
            }
          });

          // 初始化TOTP
          function initTotp(secret) {
            hideError();
            const currentPath = window.location.pathname;
            const newPath = '/' + encodeURIComponent(secret);
            
            if (currentPath !== newPath) {
              // 使用 history.pushState 更新 URL，不刷新页面
              history.pushState({ secret: secret }, '', newPath);
            }

            // 显示加载状态
            codeContainer.style.display = 'none';
            secondsContainer.style.display = 'none';
            getBtn.disabled = true;
            getBtn.textContent = '生成中...';

            // 模拟异步请求（实际在 Worker 中处理）
            fetch(newPath + '?format=json')
              .then(response => {
                if (!response.ok) {
                  throw new Error('生成失败');
                }
                return response.json();
              })
              .then(data => {
                tokenEl.textContent = data.token;
                codeContainer.style.display = 'block';
                secondsContainer.style.display = 'block';
                
                // 计算剩余时间
                const epochTime = Math.floor(Date.now() / 1000);
                const currentCounter = Math.floor(epochTime / totalTime);
                const expirationTime = (currentCounter + 1) * totalTime;
                remaining = expirationTime - epochTime;
                
                startTimer();
                getBtn.disabled = false;
                getBtn.textContent = '获取';
              })
              .catch(error => {
                showError('密钥格式错误，请检查Base32格式');
                getBtn.disabled = false;
                getBtn.textContent = '获取';
              });
          }

          // 开始计时器
          function startTimer() {
            if (intervalId) {
              clearInterval(intervalId);
            }
            
            // 设置初始进度
            updateProgress();
            
            intervalId = setInterval(() => {
              remaining--;
              updateProgress();
              
              if (remaining <= 0) {
                clearInterval(intervalId);
                // 自动刷新
                if (currentSecret) {
                  initTotp(currentSecret);
                }
              }
            }, 1000);
          }

          // 更新进度条和显示
          function updateProgress() {
            const press = (remaining / totalTime) * 100;
            pressBar.style.width = (press > 100 ? 100 : press) + '%';
            secondsEl.textContent = remaining;
          }

          // 点击复制功能
          tokenEl.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(tokenEl.textContent);
              copiedEl.classList.add('show');
              setTimeout(() => {
                copiedEl.classList.remove('show');
              }, 2000);
            } catch (err) {
              console.error('复制失败:', err);
            }
          });

          // 显示错误
          function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            secretInput.classList.add('is-error');
          }

          // 隐藏错误
          function hideError() {
            errorMessage.style.display = 'none';
            secretInput.classList.remove('is-error');
          }

          // 更新URL（不刷新页面）
          function updateUrl(secret) {
            const newPath = '/' + encodeURIComponent(secret);
            history.pushState({ secret: secret }, '', newPath);
          }

          // 处理浏览器前进后退
          window.addEventListener('popstate', (e) => {
            if (e.state && e.state.secret) {
              secretInput.value = e.state.secret;
              currentSecret = e.state.secret;
              initTotp(e.state.secret);
            }
          });
        </script>
      </body>
    </html>
    `;

    // 构建 HTML 格式的 Response
    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    // 错误处理
    return new Response(`Error: ${error.message}\n\nPlease check your secret key format. It should be Base32 encoded (A-Z, 2-7).`, {
      status: 400,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  }
}

// 生成 OTP 的函数
async function generateOTP(secret) {
  // 获取当前时间戳
  const epochTime = Math.floor(Date.now() / 1000);

  // 计算当前时间片
  let counter = Math.floor(epochTime / TIME_STEP);

  // 将时间片转换为字节数组
  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = counter & 0xff;
    counter >>>= 8;
  }

  // 使用 crypto.subtle 计算 HMAC-SHA1
  const key = await crypto.subtle.importKey(
    'raw',
    base32toByteArray(secret),
    { name: 'HMAC', hash: { name: 'SHA-1' } },
    false,
    ['sign']
  );

  const hmacBuffer = await crypto.subtle.sign('HMAC', key, counterBytes.buffer);
  const hmacArray = Array.from(new Uint8Array(hmacBuffer));

  // 将结果转换为 OTP
  const offset = hmacArray[hmacArray.length - 1] & 0xf;
  const truncatedHash = hmacArray.slice(offset, offset + 4);
  const otpValue = new DataView(new Uint8Array(truncatedHash).buffer).getUint32(0) & 0x7fffffff;
  const otp = (otpValue % Math.pow(10, OTP_LENGTH)).toString().padStart(OTP_LENGTH, '0');

  return otp;
}

// 辅助函数：将 Base32 编码的密钥转换为字节数组
function base32toByteArray(base32) {
  const charTable = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  // 移除填充字符并转为大写
  const cleanedBase32 = base32.toUpperCase().replace(/=+$/, '');
  const base32Chars = cleanedBase32.split('');

  // 验证所有字符是否有效
  for (const char of base32Chars) {
    if (charTable.indexOf(char) === -1) {
      throw new Error(`Invalid Base32 character: '${char}'. Only A-Z and 2-7 are allowed.`);
    }
  }

  // 转换为二进制字符串
  const bits = base32Chars.map(char => charTable.indexOf(char).toString(2).padStart(5, '0')).join('');

  // 转换为字节数组
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 <= bits.length) {
      bytes.push(parseInt(bits.slice(i, i + 8), 2));
    }
  }

  return new Uint8Array(bytes);
}

// 辅助函数：计算 OTP 剩余有效时间
function calculateRemainingTime() {
  const epochTime = Math.floor(Date.now() / 1000);
  const currentCounter = Math.floor(epochTime / TIME_STEP);

  // 计算下一个时间片的开始时间
  const expirationTime = (currentCounter + 1) * TIME_STEP;

  // 计算剩余时间（修复：使用当前时间而不是加载时间）
  const remainingTime = expirationTime - epochTime;

  return remainingTime;
}
