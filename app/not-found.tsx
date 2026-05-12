import Link from "next/link";
import { GraduationCap, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
          <GraduationCap className="w-10 h-10 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home className="w-4 h-4" />
              Home
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="gap-2">
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
