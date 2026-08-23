import re

with open('components/SOSListModal.tsx', 'r') as f:
    code = f.read()

old_str = """  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };"""

new_str = """  const handleCall = (phone: string) => {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.Android && window.Android.makeSipCall) {
      // @ts-ignore
      window.Android.makeSipCall(phone, "Emergency Contact", "", "");
    } else {
      window.location.href = `tel:${phone}`;
    }
  };"""

code = code.replace(old_str, new_str)

with open('components/SOSListModal.tsx', 'w') as f:
    f.write(code)
