declare namespace chrome {
  namespace storage {
    interface LocalStorageArea {
      get(
        keys: string | string[] | object | null,
        callback?: (items: { [key: string]: any }) => void,
      ): void;
      set(items: { [key: string]: any }, callback?: () => void): void;
    }

    const local: LocalStorageArea;
  }

  namespace tabs {
    function query(
      queryInfo: {
        active?: boolean;
        currentWindow?: boolean;
      },
      callback: (tabs: Array<{ id?: number }>) => void,
    ): void;

    function sendMessage(
      tabId: number,
      message: any,
      options?: any,
      responseCallback?: (response: any) => void,
    ): void;
  }

  namespace runtime {
    function sendMessage(
      message: any,
      options?: any,
      responseCallback?: (response: any) => void,
    ): void;

    const id: string;
  }
}
