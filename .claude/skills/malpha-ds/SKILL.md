Proof-of-concept “data scientist” pipeline for a given workstream or “treasure map” (/malpha-ds):

A few elements on the tech stack and processing best practices:
Language: Python
File type: Python notebook (.ipynb)
Libraries: pandas, numpy, plotly
Ingested files types: CSV, parquet
Techniques for processing large files (~10GB): streaming the data processing in 50K-row chunks

For the user:

Start with what the right problem that you will add to your prompt (e.g. “Do a join with NPIs to get all CPT codes per NPI on public claims datasets from medicaid and medicare”)
This input is an output of brainstorming on whiteboard / pen & paper within workstreams (e.g. cost, quality, independence status, etc.), with an AI sidekick of course
Uncovering both data sources as inputs (e.g. medicaid claims data)
Business logic for processing (e.g. join that with NPI to get all procedure performed per NPI for any given time range)
Final variables for outputs (e.g. all CPT codes for any given time range for any given NPI)
Get the datasets files
Create project folder if not already done
Access Claude Code session
Load files in main directory (i.e. project folder > dataset_file_example.csv)
Load this skill /malpha-ds at the end of your prompt to perform steps 7 and further (project folder > .claude folder > skills folder > malpha-ds folder > SKILL.md file)

With AI’s help (this is where the SKILL.md flow actually comes in):

Load parquet or CSV dataset from main directory on the Python notebook file 
Perform EDA (exploratory data analysis)
Uncover the schema for the files (i.e. columns)
Uncover the shape (number of rows and columns per file)
Uncover the proportion of null values per column
Uncover the data types
Output a few charts to get a sense of the data we’re working with
Perform data preprocessing/cleaning: Harmonize data types for fields of interest
Perform the join if applicable given the right problem outlined by the user
Prove that it works in the final cell where you query one or a few elements from within your right problem
Add a README.md with datasets Google Drive downloadable links as well as source URLs
Push to Github for collaboration

For the user:

Send Github repo link to the #engineering Slack channel for ingestion into the lake & warehouse
