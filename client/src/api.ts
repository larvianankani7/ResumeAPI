const API = 'http://localhost:3000';

export async function login(
  email: string,
  password: string
) {
  const response = await fetch(
    `${API}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'Login failed'
    );
  }

  return data;
}

export async function verifyOtp(
  email: string,
  otp: string
) {
  const response = await fetch(
    `${API}/api/auth/verify-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        otp
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'Invalid OTP'
    );
  }

  return data;
}

export async function refreshAccessToken(
  refreshToken: string
) {
  const response = await fetch(
    `${API}/api/auth/refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refreshToken
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error || 'Session expired'
    );
  }

  return data.accessToken;
}

export async function downloadResume(
  accessToken: string,
  refreshToken: string,
  onRefresh: (token: string) => void
) {
  let response = await fetch(
    `${API}/api/resume`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (response.status === 401) {
    const newAccessToken =
      await refreshAccessToken(refreshToken);

    onRefresh(newAccessToken);

    response = await fetch(
      `${API}/api/resume`,
      {
        headers: {
          Authorization: `Bearer ${newAccessToken}`
        }
      }
    );
  }

  if (!response.ok) {
    throw new Error(
      'Failed to download resume'
    );
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'resume.pdf';
  link.click();

  URL.revokeObjectURL(url);
}