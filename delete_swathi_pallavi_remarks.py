"""
Script to remove remarks from swathi and pallavi users in the admin dashboard market center
"""
import pymysql

def delete_remarks():
    """Delete remarks from users swathi and pallavi"""
    try:
        # Connect to MySQL
        conn = pymysql.connect(
            host='localhost',
            user='root',
            password='pallavigowda542004',
            database='agri_predict'
        )
        
        cursor = conn.cursor()
        
        # First, check what remarks exist from swathi and pallavi
        print("=== Checking existing remarks from swathi and pallavi ===")
        cursor.execute("SELECT id, username, remark, created_at FROM remarks WHERE username IN ('swathi', 'pallavi')")
        remarks = cursor.fetchall()
        
        if remarks:
            print(f"Found {len(remarks)} remarks to delete:")
            for r in remarks:
                print(f"  ID: {r[0]}, Username: {r[1]}, Remark: {r[2]}, Date: {r[3]}")
        else:
            print("No remarks found from swathi or pallavi")
        
        # Delete remarks from swathi and pallavi
        print("\n=== Deleting remarks from swathi and pallavi ===")
        cursor.execute("DELETE FROM remarks WHERE username IN ('swathi', 'pallavi')")
        
        # Get the number of rows affected
        rows_deleted = cursor.rowcount
        print(f"Deleted {rows_deleted} remarks")
        
        # Commit the changes
        conn.commit()
        
        # Verify deletion
        print("\n=== Verifying deletion ===")
        cursor.execute("SELECT COUNT(*) FROM remarks WHERE username IN ('swathi', 'pallavi')")
        remaining = cursor.fetchone()[0]
        print(f"Remaining remarks from swathi/pallavi: {remaining}")
        
        # Show all remaining remarks
        print("\n=== All remaining remarks ===")
        cursor.execute("SELECT id, username, remark, created_at FROM remarks ORDER BY created_at DESC")
        all_remarks = cursor.fetchall()
        
        if all_remarks:
            for r in all_remarks:
                print(f"  ID: {r[0]}, Username: {r[1]}, Remark: {r[2]}, Date: {r[3]}")
        else:
            print("  No remarks remaining")
        
        cursor.close()
        conn.close()
        
        print("\n=== Operation completed successfully ===")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    delete_remarks()

