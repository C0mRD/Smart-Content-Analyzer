"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChromeStorage, isChromeBrowser } from "@/lib/utils";

export default function ContentExtractorPage() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedElements, setSelectedElements] = useState<
    Array<{ selector: string; text: string }>
  >([]);

  useEffect(() => {
    const storage = getChromeStorage();
    if (storage) {
      storage.get(["selectedElements"], (result) => {
        if (result.selectedElements) {
          setSelectedElements(result.selectedElements);
        }
      });
    }
  }, []);

  const startManualSelection = () => {
    if (!isChromeBrowser()) {
      console.warn("Not in Chrome extension context");
      return;
    }

    setIsSelectionMode(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id!, { action: "startSelection" });
    });
  };

  const stopManualSelection = () => {
    if (!isChromeBrowser()) {
      console.warn("Not in Chrome extension context");
      return;
    }

    setIsSelectionMode(false);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id!, { action: "stopSelection" });
    });
  };

  return (
    <div
      className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg z-50 overflow-y-auto"
      style={{
        width: "400px",
        height: "100vh",
        position: "fixed",
        top: 0,
        right: 0,
      }}
    >
      <div className="p-4">
        <Tabs defaultValue="manual">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="manual">Manual Selection</TabsTrigger>
            <TabsTrigger value="auto">Auto Extract</TabsTrigger>
          </TabsList>
          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>Element Selection</CardTitle>
              </CardHeader>
              <CardContent>
                {!isSelectionMode ? (
                  <Button onClick={startManualSelection} className="w-full">
                    Start Selecting Elements
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    onClick={stopManualSelection}
                    className="w-full"
                  >
                    Stop Selection
                  </Button>
                )}

                {selectedElements.length > 0 && (
                  <div className="mt-4 max-h-64 overflow-y-auto">
                    <h3 className="text-sm font-semibold mb-2">
                      Selected Elements:
                    </h3>
                    <ul className="space-y-2">
                      {selectedElements.map((element, index) => (
                        <li
                          key={index}
                          className="bg-gray-100 p-2 rounded text-xs"
                        >
                          {element.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="auto">
            <Card>
              <CardHeader>
                <CardTitle>Automatic Extraction</CardTitle>
              </CardHeader>
              <CardContent>
                <Button className="w-full">
                  Extract Content Automatically
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
