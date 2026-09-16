import { redirect } from "next/navigation";

// "/assessment" is just a friendlier alias for the quiz list page.
export default function AssessmentPage() {
  redirect("/quiz");
}
