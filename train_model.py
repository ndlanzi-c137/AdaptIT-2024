#train_model.py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer

def main():
   
    df = pd.read_csv('water_potability.csv')  

    df['Sulfate'] = df['Sulfate'].fillna(df['Sulfate'].mean())
    df.dropna(inplace=True)


   
    X = df.iloc[:, :-1]
    y = df['Potability']

   
    X_train_val, X_test, y_train_val, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    X_train, X_val, y_train, y_val = train_test_split(X_train_val, y_train_val, test_size=0.25, random_state=42)

   
    model = RandomForestClassifier()

    model.fit(X_train, y_train)

    
    y_val_pred = model.predict(X_val)
    val_accuracy = accuracy_score(y_val, y_val_pred)

    
    y_test_pred = model.predict(X_test)
    test_accuracy = accuracy_score(y_test, y_test_pred)

    
    joblib.dump(model, 'model.pkl')

    
    print(f'Validation Accuracy: {val_accuracy * 100:.2f}%')
    print(f'Test Accuracy: {test_accuracy * 100:.2f}%')

if __name__ == '__main__':
    main()
