export function useStatementLogoController({ setNotice, setSetting }) {
  const onStatementLogoInputChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setNotice("Choose an image file for the statement logo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result.startsWith("data:image/")) {
        setNotice("Could not read the logo image.");
        return;
      }
      setSetting("statementLogoDataUrl", result);
      setNotice("Statement logo saved.");
    };
    reader.onerror = () => {
      setNotice("Could not read the logo image.");
    };
    reader.readAsDataURL(file);
  };

  return { onStatementLogoInputChange };
}
