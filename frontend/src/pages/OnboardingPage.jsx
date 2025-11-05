import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const OnboardingPage = () => {
  const { authUser, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => {
    // initialize local state from user if present
    if (authUser?.username) setUsername(authUser.username);
  }, [authUser]);

  const acceptTerms = async () => {
    if (!termsChecked) {
      toast.error("Please check the Terms & Conditions checkbox");
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post("/onboarding/terms");
      toast.success("Terms accepted");
      await checkAuth();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to accept terms");
    } finally {
      setLoading(false);
    }
  };

  const saveUsername = async () => {
    const val = String(username || "").trim().toLowerCase();
    if (!/^[a-z0-9_\-]{3,20}$/.test(val)) {
      toast.error("Username must be 3–20 chars: a-z, 0-9, -, _");
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post("/onboarding/username", { username: val });
      toast.success("Username saved");
      await checkAuth();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save username");
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (String(password).length < 10) {
      toast.error("Password must be at least 10 characters");
      return;
    }
    setLoading(true);
    try {
      await axiosInstance.post("/onboarding/password", { password });
      toast.success("Password saved");
      await checkAuth();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save password");
    } finally {
      setLoading(false);
    }
  };

  const complete = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.post("/onboarding/complete");
      if (res?.data?.accountStatus === "active") {
        toast.success("Onboarding complete");
      }
      await checkAuth();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold">Finish setting up your account</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Accept Terms</h2>
        <label className="cursor-pointer flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-primary"
            checked={termsChecked || authUser?.termsAccepted}
            onChange={(e) => setTermsChecked(e.target.checked)}
            disabled={authUser?.termsAccepted}
          />
          <span>I agree to the Terms & Conditions</span>
        </label>
        <button className="btn btn-primary" onClick={acceptTerms} disabled={disabled || authUser?.termsAccepted}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Choose Username</h2>
        <input
          type="text"
          className="input input-bordered w-full"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your-username"
        />
        <button className="btn btn-primary" onClick={saveUsername} disabled={disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save username"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. Set Password</h2>
        <input
          type="password"
          className="input input-bordered w-full"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 10 characters"
        />
        <button className="btn btn-primary" onClick={savePassword} disabled={disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">4. Complete</h2>
        <button className="btn btn-success" onClick={complete} disabled={disabled}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Complete onboarding"}
        </button>
      </section>
    </div>
  );
};

export default OnboardingPage;