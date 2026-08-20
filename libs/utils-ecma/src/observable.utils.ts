export const observableUtils = {
  createObservable,
};

type Observable<Value> = {
  getValue(): Value;
  setValue(newValue: Value): void;
  subscribe(subscription: (value: Value) => void): void;
  unsubscribe(subscription: (value: Value) => void): void;
};

function createObservable<Value>(initialValue: Value): Observable<Value> {
  let value = initialValue;
  let subscriptions: Array<(value: Value) => void> = [];

  return {
    getValue(): Value {
      return value;
    },
    setValue(newValue: Value): void {
      value = newValue;
      for (const subscription of subscriptions) {
        subscription(newValue);
      }
    },
    subscribe(subscription: (value: Value) => void): void {
      subscriptions = [...subscriptions, subscription];
    },
    unsubscribe(subscription: (value: Value) => void): void {
      subscriptions = subscriptions.filter(
        (existingSubscription) => existingSubscription !== subscription,
      );
    },
  };
}
