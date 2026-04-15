async function testSignup() {
    const email = `testOTP_${Date.now()}@example.com`;
    console.log(`Registration test for: ${email}`);
    
    try {
        const res = await fetch('http://localhost:5008/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fullname: 'OTP Test',
                phone: '1234567890',
                email: email,
                password: 'Password123'
            })
        });
        const data = await res.json();
        console.log('Register Response:', res.status, data);

        if (res.status === 201 && data.needVerification) {
            console.log('✅ Registration successfully requested verification.');
            
            // Try to login immediately
            console.log('Trying to login...');
            const loginRes = await fetch('http://localhost:5008/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: 'Password123' })
            });
            const loginData = await loginRes.json();
            console.log('Login Response:', loginRes.status, loginData);
            
            if (loginRes.status === 403 && loginData.needVerification) {
                console.log('✅ Login successfully blocked an unverified user.');
            } else {
                console.log('❌ Login did not block properly.');
            }
        } else {
            console.log('❌ Registration did not behave as expected.');
        }

    } catch (err) {
        console.log('Server not contactable. Is it running?', err.message);
    }
}
testSignup();
