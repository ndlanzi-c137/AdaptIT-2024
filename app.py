import sys
import json
import pandas as pd
import joblib
from sqlalchemy import create_engine

def main():
    # Load the trained model
    model = joblib.load('model.pkl')
    
    # Read the input data (area)
    input_data = json.loads(sys.stdin.read())
    area = input_data['area']

    # Create SQLAlchemy engine
    engine = create_engine(
        'mysql+pymysql://dining:Service123@dining-service-db.mysql.database.azure.com:3306/WaterQuality',
        connect_args={'ssl': {'ca': 'DigiCertGlobalRootCA.crt.pem'}}
    )

    # Define the query to get water quality data
    query = f"""
        SELECT ph, Hardness, Solids, Chloramines, Sulfate, Conductivity, Organic_carbon, Trihalomethanes, Turbidity 
        FROM WaterQualityData 
        WHERE area = '{area}' 
        ORDER BY date_recorded DESC 
        LIMIT 1
    """

    # Execute query and load data into pandas DataFrame
    data = pd.read_sql(query, engine)
    
    if data.empty:
        print(json.dumps({'error': 'No data available for this area'}))
        return
    
    # Convert DataFrame to numeric values and handle missing values
    data_numeric = data.apply(pd.to_numeric, errors='coerce')

    # Check for missing or invalid data
    if data_numeric.isnull().values.any():
        print(json.dumps({'error': 'Invalid data for prediction'}))
        return
    
    # Make a prediction using the model
    prediction = model.predict(data_numeric)

    # Send the result back to the server
    results = {
        'prediction': int(prediction[0])
    }
    print(json.dumps(results))

if __name__ == '__main__':
    main()
